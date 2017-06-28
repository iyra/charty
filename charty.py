from PIL import  Image, ImageFont, ImageDraw
import uuid
import json
import hashlib
import bcrypt
IMGDIR="/var/www/charty/chart-images"
THUMBDIR="/var/www/charty/chart-thumbs"
DBFILE="/var/www/charty/chart-db"
USERDBFILE="/var/www/charty/user-db"
USERCHARTFILE="/var/www/charty/user-charts"
CHARTDIR="/var/www/charty/charts"
STATICDIR="/var/www/charty/static"
UPLOAD_FOLDER = '/tmp'
LASTFM_API = ""
DISCOGS_TOKEN = ""
ALLOWED_EXTENSIONS = set(['png', 'jpg', 'jpeg', 'gif'])
chart_settings = ['x','y','tile_width','margin_r', 'margin_b']
styles = ['topsters2', 'top42', 'axb']
          
from flask import Flask, request, session, g, redirect, url_for, abort, render_template, flash, send_from_directory
import discogs_client as dc
import re
import urllib.request
import requests
import os
from werkzeug.utils import secure_filename
import urllib.parse
import requests
import shutil
from flask.sessions import SessionInterface
from beaker.middleware import SessionMiddleware

class BeakerSessionInterface(SessionInterface):
    def open_session(self, app, request):
        session = request.environ['beaker.session']
        return session

    def save_session(self, app, session, response):
        session.save()

app = Flask(__name__, static_url_path='')
app.debug = True
app.config['TEMPLATES_AUTO_RELOAD'] = True
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024
ds = dc.Client('charty/1.0', user_token=DISCOGS_TOKEN)
session_opts = {
    'session.type': 'file',
    'session.data_dir': './cache',
}
app.wsgi_app = SessionMiddleware(app.wsgi_app, session_opts)
app.session_interface = BeakerSessionInterface()

def posgen(opts):
    images = opts['images']
    text = ""
    if opts['style']=="topsters2":
        images = prepare(images, 100)
        rows = [(5, 300, 18, 16),
                (5, 300, 18, 16),
                (6, 250, 14, 8),
                (6, 250, 14, 8),
                (6, 250, 14, 8),
                (10,150, 8,  8),
                (10,150, 8, 8),
                (10,150,8,8),
                (14,100,13,10),
                (14,100,13,10),
                (14,100,13,10)]
    elif opts['style']=="top42":
        images = prepare(images, 42)
        rows = [(5, 300, 18, 16),
                (5, 300, 18, 16),
                (6, 250, 14, 8),
                (6, 250, 14, 8),
                (10,150, 8,  8),
                (10,150,8,8)]
    elif opts['style']=="axb":
        images = prepare(images, 1+opts['x']*opts['y'])
        a = opts['x']
        b = opts['y']
        margin_r = opts['margin_r']
        margin_b = opts['margin_b']
        w = opts['tile_width']
        rows = []
        for row in range(0,b):
            rows.append((a, w, margin_r, margin_b))
    i = 0
    height = opts['padding'][1]
    width = opts['padding'][0]
    locations = []
    for rn, row in enumerate(rows):
        imgs = images[i:i+row[0]]
        for n, img in enumerate(imgs):
            # n is the nth image in this row
            if img:
                img['position'] = (opts['padding'][0] + n*row[2] + n*row[1], height)
                img['maxdims'] = (row[1], row[1])
                text += img['artist'] + " - " + img['album'] + "\n"
            locations.append(img)
        if rn != len(rows)-1:
            height += row[3] + row[1]
        else:
            height += row[1]
        i = i+row[0]
        text += "\n"
    width += rows[0][0]*rows[0][1]+(rows[0][0]*rows[0][2])
    return (locations, width, height+opts['padding'][0], text)
    
def prepare(images, num):
    slist = []
    k = images.keys()
    for i in range(num):
        if str(i) in k:
            slist.append(images[str(i)])
        else:
            slist.append(False)
    return slist

def hex_to_int_color(v):
    if v[0] == '#':
        v = v[1:]
    assert(len(v) == 6)
    return (int(v[:2], 16), int(v[2:4], 16), int(v[4:6], 16))
        
def make(opts):
    width = 0
    height = 0
    images, width, height, text = posgen(opts)
    textsize = (0,0)
    if opts['with_text']:
        fontcolor = (255, 255, 255)
        fontsize = 14
        font = ImageFont.truetype("noto.ttc", fontsize)
        img = Image.new("RGBA", (1,1))
        draw = ImageDraw.Draw(img)
        textsize = draw.textsize(text, font)

    if height < textsize[1]:
        dh = textsize[1]-height
    else:
        dh = 0
    chart = Image.new("RGB", (width+textsize[0]+opts['padding'][0], height+dh+opts['padding'][1]), opts['background'])
    for image in images:
        if image:
            im = Image.open(IMGDIR+"/"+image['img'])
            im.thumbnail(image['maxdims'], Image.BICUBIC)
            if im.width < image['maxdims'][0]:
                rem = image['maxdims'][0]-im.width
                image['position'] = (image['position'][0] + int(rem/2), image['position'][1])
            if im.height < image['maxdims'][1]:
                rem = image['maxdims'][1]-im.height
                image['position'] = (image['position'][0], image['position'][1]+ int(rem/2))
            chart.paste(im, image['position'])

    if opts['with_text']:
        draw = ImageDraw.Draw(chart)
        draw.text((width, opts['padding'][1]), text, opts['text_colour'], font)

    hexname = str(uuid.uuid4().hex.upper()[0:10])+".png"
    filename = STATICDIR+"/"+hexname
    chart.save(filename, "PNG")
    return hexname

def validate_colour(colour):
    match = re.search(r'^#(?:[0-9a-fA-F]{3}){1,2}$', colour)
    if match and ((len(colour) == 7 and colour[0] == "#")):
        return (True, hex_to_int_color(colour))
    return (False, 0)

def clean_image_j(image_j):
    #image_j is a json of images
    opts = {}
    try:
        y = json.loads(image_j)
    except ValueError as e:
        return (False, "Decoding error: "+e)
    if not all(x in y.keys() for x in chart_settings):
        return (False, "Options must include "+", ".join(chart_settings))
    try:
        # style, padding, whether there is text and style
        opts['style'] = y.pop("style", None)
        opts['padding'] = (int(y.pop('padding_x', None)), int(y.pop('padding_y', None)))
        opts['with_text'] = bool(y.pop('with_text', None))
        if opts['style'] not in styles:
            return (False, "Unrecognised style.")

        # deal with colours for background and foreground
        valid_colour = validate_colour(y.pop("background", None))
        if valid_colour[0]:
            opts['background'] = valid_colour[1]
        else:
            return (False, "Not a valid background colour.")

        valid_colour = validate_colour(y.pop("text_colour", None))
        if valid_colour[0]:
            opts['text_colour'] = valid_colour[1]
        else:
            return (False, "Not a valid text colour.")

        # deal with rest of options
        print(y.keys())
        for opt in chart_settings:
            opts[opt] = int(y.pop(opt, None))
    except ValueError:
        return (False, "Could not convert AxB options to integer")
    except TypeError as e:
        return (False, str(e))
    
    for k, v in y.items():
        try:
            int(k)
        except ValueError:
            return (False, "Could not convert key to integer")
        if not all(x in v.keys() for x in ['id',
                  'artist',
                  'album',
                  'inf',
                  'img',
                  'thumb']):
            return (False, "Some values missing in album list")
        for e in v.items():
            if len(e) < 1:
                return (False, "Values must be length 1 or greater")
        if not (allowed_file(v['img']) and allowed_file(v['thumb'])):
            return (False, "Filenames must have extensions and valid extension.")
        if v['img'] != secure_filename(v['img']) or v['thumb'] != secure_filename(v['thumb']):
            return (False, "Filenames must not be paths")
        if not (os.path.isfile(IMGDIR+"/"+v['img']) or os.path.isfile(THUMBDIR+"/"+v['thumb'])):
            return (False, "Files couldn't be found")
    opts['images'] = y
    return (True, opts)

def search_lfm(term):
    try:
        r = requests.get("http://ws.audioscrobbler.com/2.0/?album=%s&limit=8&method=album.search&api_key="+LASTFM_API+"&format=json" % term)
        res = []
        als = r.json()['results']['albummatches']['album']
        for a in als:
            if len(a['image'][3]['#text']) > 0:
                res.append({'id':"LFM"+hashlib.sha1(a['url'].encode('utf-8')).hexdigest()[0:6],
                            'artist':a['artist'],
                            'album': a['name'],
                            'inf': ".",
                            'thumb': a['image'][2]['#text'],
                            'img': a['image'][3]['#text']})
        return (True, res)
    except requests.exceptions.ConnectionError:
        return (False, 'Connection error to Last.fm, please report this issue.')

def search_dis(term):
    res = []
    results = ds.search(term, type='release', per_page=7)
    results = results.page(1)
    i = 0
    for result in results:
        if result.images is not None:
            i += 1
            if i==7:
                break
            res.append({'id':"DIS"+str(result.id),
                        'artist': "",
                        'album': result.title,
                        'inf': str(result.year),
                        'thumb':result.thumb,
                        'img':result.images[0]['uri']})
    return res

def search_db(term, ar):
    res = []
    with open(DBFILE, "r") as f:
        for line in f:
            for t in term.split(' '):
                if re.match('.*%s.*' % t, line, re.I):
                    d = line.split('\t')
                    if ((len(ar) > 0 and (d[0] not in allids(ar))) or len(ar) == 0) and (d[0] not in allids(res)):
                        # if there are results not from the DB and this db result isn't in there, OR it's a db-only search, then append
                        res.append({'id':d[0],
                                    'artist':d[1],
                                    'album':d[2],
                                    'inf':d[3],
                                    'thumb':d[4],
                                    'img':d[5][:-1]})
    return res

# db is in the format: id\tartist\talbum\tother info such as romanization (or a .)\tthumb url\timg url\n
@app.route("/search/<string:term>/<string:mode>/<int:j>")
def search(term, mode, j):
    if len(mode) != 3:
        return json.dumps({'error':"Mode length must be 3"})
    res = []
    if mode[0] == "1":
        res = res+search_dis(term)
    if mode[1] == "1":
        u = search_lfm(term)
        if not u[0]:
            return json.dumps({'error': u[1]})
        res = res+u[1]
    if mode[2] == "1":
        res = res+search_db(term, res)
    
    if j==1:
        return json.dumps({'covers':res})
    return res

def allids(res):
    keys = []
    for r in res:
        keys.append(r['id'])
    return keys

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def in_db(aid):
    with open(DBFILE, "r") as f:
        for line in f:
            data = line.split('\t')
            if len(data) > 2:
                if data[0] == aid:
                    return True
    return False

def get_from_db(aid):
    with open(DBFILE, "r") as f:
        for line in f:
            d = line.split('\t')
            if len(d) > 2:
                if d[0] == aid:
                    return (True, {'id':d[0],
                                   'artist':d[1],
                                   'album':d[2],
                                   'inf':d[3],
                                   'thumb':d[4],
                                   'img':d[5][:-1]})
    return (False, {})

@app.route('/new_album_url', methods=['POST'])
def new_album_url():
    # 1. checks if the artist is blank (if it is, fill it in cuz it's beacuse of discogs)
    # 2. uploads the images (img and thumb) to the server and returns json of the album with the filenames
    if request.method == 'POST':
        d = request.get_json(force=True)
        if all (k in d for k in ('artist','album','inf','img','thumb', 'id')):
            if in_db(d['id']):
                # this could be an already-uploaded thing, so fetch the "corrected" version from the db
                return json.dumps(get_from_db(d['id'])[1])
            if d['artist'] == "":
                # probably because we don't collect the artist from discogs when generating the thumbs
                if d['id'].startswith("DIS"):
                    try:
                        g = int(d['id'][3:])
                        release = ds.release(g)
                        names = ""
                        for i, at in enumerate(release.artists):
                            if i > 0:
                                names = names+", "+at.name
                            else:
                                names = at.name
                        d['artist'] = names
                    except ValueError:
                        return json.dumps({'error': "Could not convert release ID to integer."})
                    except dc.exceptions.HTTPError as e:
                        return json.dumps({'error': e})
            res = {'artist': d['artist'],
                   'album': d['album'],
                   'inf': d['inf'],
                   'img': d['img'],
                   'thumb': d['thumb'],
                   'id': d['id']}
            r, err = add_db(res)
            if not r:
                return json.dumps({'error': err})
            # second return value is called err but contains the data if r=True...
            res['img'] = err['img']
            res['thumb'] = err['thumb']
            return json.dumps(res)
        else:
            return {'error': 'Not all values present'}          


@app.route('/gen', methods=['POST', 'GET'])
def chart_gen():
    chart_opts = clean_image_j(request.form['chart'])
    if not chart_opts[0]:
        return json.dumps({'error':chart_opts[1]})
    filename = make(chart_opts[1])
    return json.dumps({'file':filename})

@app.route('/new_album', methods=['GET', 'POST'])
def new_album():
    if request.method == 'POST':
        # check if the post request has the file part
        if 'cover' not in request.files:
            return json.dumps({'error': 'No file part.'})
        file = request.files['cover']
        # if user does not select file, browser also
        # submit a empty part without filename
        if file.filename == '':
            return json.dumps({'error': 'No file selected.'})
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            h = str(uuid.uuid4().hex.upper()[0:5])
            filename = h + filename
            loc = os.path.join(IMGDIR, filename)
            file.save(loc)
            #return "file saved as "+filename
            im = Image.open(loc)
            im.thumbnail((150,150), Image.BICUBIC)
            im.save(os.path.join(THUMBDIR, "thumb_"+filename))

            e = {'id': h,
                 'artist': request.form['artist'],
                 'album': request.form['album'],
                 'inf': request.form['info'],
                 'img': filename,
                 'thumb': "thumb_"+filename}
            r, err = add_db(e)
            if not r:
                return json.dumps({'error': err})
            else:
                return json.dumps(e)
        return json.dumps({'error': "Bad file type."})

def download(url, loc):
    try:
        r = requests.get(url, stream=True)
        if r.status_code == 200:
            try:
                with open(loc, 'wb') as f:
                    r.raw.decode_content = True
                    shutil.copyfileobj(r.raw, f)
                return (True, 0)
            except IOError as e:
                return (False, 'File download error: IO Error: {0}: {1}'.format(e.errno, e.strerror))
            except shutil.Error as e:
                return (False, 'File download error: Copy error: %s' % e)
        else:
            return (False, 'File download error (HTTP): '+str(r.status_code))
    except requests.exceptions.RequestException as e:
        return (False, 'File download error: {0}: {1}'.format(e.errno, e.strerror))
    
def add_db(r):
    if all (k in r for k in ('artist','album','inf','img','thumb', 'id')):
        if r['img'].startswith("http"):
            if allowed_file(r['img']) and allowed_file(r['thumb']):
                img_ext = os.path.splitext(urllib.parse.urlparse(r['img']).path)[1]
                thumb_ext = os.path.splitext(urllib.parse.urlparse(r['thumb']).path)[1]
                h = str(uuid.uuid4().hex.upper()[0:4])
                img_loc = ''.join(e for e in r['artist']+"_"+r['album']+"_"+h if e.isalnum())+img_ext
                thumb_loc = ''.join(e for e in r['artist']+"_"+r['album']+"_"+h+"_thumb" if e.isalnum())+thumb_ext

                img_download = download(r['img'], IMGDIR+"/"+secure_filename(img_loc))
                thumb_download = download(r['thumb'], THUMBDIR+"/"+secure_filename(thumb_loc))
                if not img_download[0]:
                    return (False, 'DB add error: '+img_download[1])
                if not thumb_download[0]:
                    return (False, 'DB add error: '+thumb_download[1])

                r['img'] = secure_filename(img_loc)
                r['thumb'] = secure_filename(thumb_loc)
            else:
                return (False, "DB Add error: bad file extension on image or thumbnail")

        try:
            with open(DBFILE, "a") as f:
                f.write("%s\t%s\t%s\t%s\t%s\t%s\n" % (r['id'], r['artist'], r['album'], r['inf'], r['thumb'], r['img']))
            return (True, r)
        except IOError as e:
            return (False, 'DB add error: IO Error: {0}: {1}'.format(e.errno, e.strerror))
    return (False, 'DB add error: not all keys in request to add to database.')

@app.route("/help")
def help():
    return render_template("help.html")

@app.route("/chart/<string:chart>")
@app.route("/")
def index(chart=""):
    if chart != "":
        data = False
        with open(USERCHARTFILE, "r") as f:
            for line in f:
                x = line.split('\t')
                if len(x) == 3:
                    if x[1] == chart:
                        with open(CHARTDIR+"/"+x[1], "r") as y:
                            data = json.load(y)
                            chart_id = x[1]
                            is_public = x[2][:-1]
        if data:
            if is_public == "1" or (is_logged_in() and is_users_chart(chart_id, session['username'])):
                return render_template("index.html", r=json.dumps(data), error="", wc=True, chartname=chart) #good
            else:
                return render_template("index.html", r="", error="You can't access this chart, because it is not public.", wc=False, chartname="") #err
    return render_template("index.html", r="", error="", wc=False, chartname="")

@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory(STATICDIR, path)

@app.route('/img/<path:path>')
def send_img(path):
    #path = urllib.parse.quote_plus(path)
    return send_from_directory(IMGDIR, path)

@app.route('/thumb/<path:path>')
def send_thumb(path):
    #path = urllib.parse.quote_plus(path)
    return send_from_directory(THUMBDIR, path)

def get_users():
    upl = []
    with open(USERDBFILE, 'r') as f:
        for line in f:
            x = line.split('\t')
            if len(x) > 1:
                upl.append({'username': x[0],
                            'password': x[1][:-1]})
    return upl

def get_user(name):
    for u in get_users():
        if u['username'] == name:
            return u
    return False

def add_user(name, password):
    p = bcrypt.hashpw(password, bcrypt.gensalt())
    with open(USERDBFILE, 'a') as f:
        f.write('{}\t{}\n'.format(name, p.decode('utf-8')))
    return True

@app.route('/login_test')
def login_test():
    if is_logged_in():
        return session['username']
    return "no"

def is_logged_in():
    if 'username' in session:
        return session['username']
    return False

@app.route('/logout')
def logout():
    if 'username' in session: del session['username']
    return json.dumps({'r':'logged out'})

# username\tchart_id\tis_public
@app.route('/user_charts/<username>')
def user_charts(username,j=True):
    if not get_user(username):
        return json.dumps({'error': 'User does not exist.'})
    charts = []
    pub_charts = []
    with open(USERCHARTFILE, "r") as f:
        for line in f:
            x = line.split('\t')
            if len(x) == 3:
                if x[0] == username:
                    with open(CHARTDIR+"/"+x[1], "r") as y:
                        data = json.load(y)
                        data['chart_id'] = x[1]
                        data['is_public'] = x[2][:-1]
                        charts.append(data)
    if is_logged_in():
        if session['username'] == username:
            if j:
                return json.dumps(charts)
            return charts
    for c in charts:
        if c['is_public'] == "1":
            pub_charts.append(c)
    if j:
        return json.dumps(pub_charts)
    return pub_charts

@app.route('/chart_exists/<chart>')
def chart_exists(chart):
    return os.path.isfile(CHARTDIR+"/"+chart)

def is_users_chart(chart, username):
    a = user_charts(username, False)
    for e in a:
        if e['chart_id'] == chart:
            return True
    return False

@app.route('/save_user_chart', methods=['POST'])
def save_user_chart():
    if is_logged_in():
        if 'chart' in request.form:
            c = request.form['chart']
            c_n = request.form['chart_id']
            c_p = request.form['is_public']
            c_o = request.form['overwrite']
            if not re.compile("^([\-_a-zA-Z0-9])+$").match(c_n):
                return json.dumps({'error':'Chart name must only contain alphanumeric characters, dashes and underscores.'})
            if c_p not in ["0", "1"] or c_o not in ["0", "1"]:
                return json.dumps({'error':'is_public and overwrite should be 0 or 1'})
            if (chart_exists(c_n) and c_o == "1" and is_users_chart(c_n, session['username'])) or not chart_exists(c_n):
                if c_o != "1" or not chart_exists(c_n):
                    # not overwriting, so append to list of files
                    with open(USERCHARTFILE,"a") as f:
                        f.write("{}\t{}\t{}\n".format(session['username'],
                                                      c_n,
                                                      c_p))
                with open(CHARTDIR+"/"+c_n, "w") as f:
                    f.write(c)
                return json.dumps({'name':c_n})
            if chart_exists(c_n) and not is_users_chart(c_n, session['username']):
                return json.dumps({'error':'A chart by that name already exists, and it belongs to someone else. Choose another name.'})
            elif chart_exists(c_n) and is_users_chart(c_n, session['username']) and c_o != "1":
                return json.dumps({'error':'If you want to overwrite this chart, tick the \'Overwrite\' checkbox.'})
    else:
        return json.dumps({'error':'you must be logged in to save a chart'})    
            
@app.route('/login', methods=['POST'])
def login():
    if 'username' in request.form and 'password' in request.form:
        u = request.form['username']
        if not re.compile("^([\-_a-zA-Z0-9])+$").match(u):
            return json.dumps({'error':'Username must only contain alphanumeric characters, dashes and underscores.'})
        p = request.form['password'].encode('utf-8')
        t = get_user(u)
        if t:
            # the user exists
            if bcrypt.hashpw(p, t['password'].encode('utf-8')) == t['password'].encode('utf-8'):
                # password matches
                session['username'] = u
                return json.dumps({'username':u})
            else:
                return json.dumps({'error':"Wrong password"})
        else:
            add_user(u, p)
            session['username'] = u
            return json.dumps({'username':u})
    else:
        return json.dumps({'error':'Bad request, must provide username and password'})

if __name__ == "__main__":
    app.wsgi_app = SessionMiddleware(app.wsgi_app, session_opts)
    app.session_interface = BeakerSessionInterface()
    app.run(debug=True, host='0.0.0.0', port=8090)
