var pos = 0;
var chart_queue = {};
var full_chart_queue = {};
var tiles = [];
var tiles_and_rows = [];
var is_selected = true;
var selected_pos = 0;
var logged_in = false;
var username = "";
var user_chart_l = [];

function set_error(s) {
    u("#error_bar").html(s);
}

function show_thing(t) {
    t.removeClass('hidden');
}

function hide_thing(t) {
    t.addClass('hidden');
}

function toggle_thing(t) {
    t.toggleClass('hidden');
}

function toggle_import_form() {
    u("#import_form").toggleClass("hidden");
}

function toggle_save_form() {
    toggle_thing(u("#save_form"));
}

function show_export_form() {
    u("#export_form").attr('class', '');
    document.getElementById('export_form_ta').value = JSON.stringify(full_chart_queue);
}

function toggle_options_form() {
    toggle_thing(u("#options_form"));
}

function show_new_form() {
    show_thing(u("#new_form"));
}

function toggle_search_form() {
    toggle_thing(u("#search_form"));
}

function init_user() {
    var url = "/login_test";
    var options = {};
    var after = function(err, data){
	if(err){set_error(err);}else{
	    if(data!="no"){
		do_login(data);
	    }
	}
    }
    var before = function(xhr){};
    ajax(url, options, after, before);
}

function do_login(username) {
    logged_in = true;
    username = username;
    hide_thing(u('#user_section_login_area'));
    show_thing(u('#user_section_information_area'));
    show_thing(u('#user_chart_section_save_area'));
    u('#user_section_information_area_uname').html("Logged in as "+username+".");
}

function do_logout() {
    logged_in = false;
    username = "";
    show_thing(u('#user_section_login_area'));
    hide_thing(u('#user_section_information_area'));
    hide_thing(u('#user_chart_section_save_area'));
    u('#user_section_information_area_uname').html("");
}

function check_chart_exists(name) {return false;}

function toggle_userchart_form() {
    toggle_thing(u("#user_chart_list_form"));
}

function find_user_charts() {
    var userp = document.getElementById("chart_list_form_name").value;
    user_charts(userp);
}

function user_charts(un) {
    var url = "/user_charts/"+un;
    var options = {};
    var after = function(err,data){
	if(err){set_error(err);} else {
	    if(data.hasOwnProperty("error")){
		u("#error_bar").html(data['error']);
	    } else {
		if(data.length==0)
		    if(logged_in && un==username){
			u("#user_charts").html("You haven't saved any charts.");
		    } else {
			u("#user_charts").html(un+" has no public charts.");
		    }
		else {
		    u("#user_charts").html('');
		    user_chart_l = {};
		    u("#user_charts").append("<ul>");
		    var t = u("#user_charts > ul");
		    var index;
		    for(index=0; index<data.length; index++){
			t.append("<li><a target=\"_blank\" href=\"/chart/"+data[index]['chart_id']+"\">"+data[index]['chart_id']+"</a></li>");
			user_chart_l[index]=data[index];
		    }
		}
		

	    }
	}
	
    };
    var before = function(xhr){};
    ajax(url, options, after, before);
}

function save_chart() {
    console.log("background saving is "+full_chart_queue['background']);
    if(logged_in){
	var chart_id = document.getElementById('chart_save_form_title').value;
	var chart_pub = u("#chart_save_form_public").first().checked;
	var chart_overwrite = u("#chart_save_form_overwrite").first().checked;
	
	var url = "/save_user_chart";
	var options = {
	    body: {'chart_id':chart_id,
		   'is_public':chart_pub ? "1" : "0",
		   'overwrite':chart_overwrite ? "1" : "0",
		   'chart': JSON.stringify(full_chart_queue)},
	    method: 'POST'
	}
	var after = function(err, data){
	    if(err){set_error(err);} else {
		if(data.hasOwnProperty("error")){
		    set_error(data['error']);
		} else {
		    set_error("Chart "+data['name']+" saved.");
		}
	    }
	}
	var before = function(xhr){};
	ajax(url, options, after, before);
    }
}

function make_chart() {
    set_error('Trying to generate chart, please wait...');
    var url = "/gen";
    var options = {'body': {'chart': JSON.stringify(full_chart_queue)},
		   'method': 'POST' };
    	var after = function(err, data){
	    if(err){set_error(err);} else {
		if(data.hasOwnProperty("error")){
		    set_error(data['error']);
		} else {
		    set_error('Click <a target="_blank" href="/static/'+data['file']+'">here</a> to download your chart.');
		}
	    }
	}
	var before = function(xhr){};
	ajax(url, options, after, before);
}

function login() {
    var url = "/login";
    
    var options = {
	body: {'username':document.getElementById("login_form_username").value,
	       'password':document.getElementById("login_form_password").value},
	method: 'POST'
    };
    var after = function(err, data){
	if(err){set_error(err);} else {
	    if(data.hasOwnProperty("error")){
		set_error(data['error']);
	    } else {
		if(data['username'] == document.getElementById("login_form_username").value){
		    do_login(data['username']);
		}
	    }
	}
    };
    var before = function(xhr){};
    
    ajax(url, options, after, before);
}

function logout() {
    var url = "/logout";
    var options = {};
    var after = function(err, data){
	if(err){set_error(err);} else {
	    if(data.hasOwnProperty("error")){
		set_error(data['error']);
	    } else {
		do_logout();
	    }
	}
    };
    var before = function(xhr){};
    ajax(url, options, after, before);
}

function do_import(data) {
    if(validate_r(data)){
    var keys = [];
    if(data.hasOwnProperty("style"))
	begin(data);
    else
	set_error("No style specified in import code.");
    for (var key in data) {
	if (data.hasOwnProperty(key)) {
	    console.log(key);
	    if(data[key].hasOwnProperty("id") &&
	       data[key].hasOwnProperty("artist") &&
	       data[key].hasOwnProperty("album") &&
	       data[key].hasOwnProperty("inf") &&
	       data[key].hasOwnProperty("img") &&
	       data[key].hasOwnProperty("thumb")){
		append_album_queue(data[key]["id"], data[key]["artist"], data[key]["album"], data[key]["inf"], data[key]["img"], data[key]["thumb"], key);
	    } else {
		set_error("Chart album information was incomplete. Each tile must have id, artist, album, inf (info), img (large cover), thumb (small cover).");
	    }
	}
    }
    }
}

function import_from_textarea() {
    var ta = document.getElementById("import_form_ta").value;
    try {
	data = JSON.parse(ta);
	do_import(data);
    } catch(e) {
	set_error(e);
    }
}

function has_all(dict,keys){
    var index;
    for(index=0; index<keys.length; index++){
	if(!dict.hasOwnProperty(keys[index]))
	    return false;
    }
    return true;
}

function is_all_nnan(vals){
    for(index=0; index<vals.length; index++){
	if(vals[index]==NaN)
	    return false;
    }
    return true;
}

function r_values_from_form() {
    	r = {}
    var e = document.getElementById("tplopt");
	r['style'] = e.options[e.selectedIndex].value;
	r['y'] = parseInt(document.getElementById("tiles_y").value);
	r['x'] = parseInt(document.getElementById("tiles_x").value);
    r['tile_width'] = parseInt(document.getElementById("tile_width").value);
    
	r['margin_r'] = parseInt(document.getElementById("margin_r").value);
	r['margin_b'] = parseInt(document.getElementById("margin_b").value);
	r['padding_x'] = parseInt(document.getElementById("padding_x").value);
	r['padding_y'] = parseInt(document.getElementById("padding_y").value);
	r['with_text'] = document.getElementById('with_text').checked ? 1 : 0;
    r['background'] = document.getElementById("background_val").value;
        r['text_colour'] = document.getElementById("text_colour").value;

    return r;
}

function validate_colour(colour) {
    var valid_colour = colour.match(/^#([0-9a-fA-F]{6})$/i) ? 1 : 0;
    if(!valid_colour){ set_error("You must input a valid 6-character hex colour code with a # at the start, such as #abc123"); return false; }
    return true;
}

function validate_r(r) {
    if(!has_all(r, ['style','y','x','tile_width','margin_r','margin_b','background', 'padding_x', 'padding_y', 'with_text', 'text_colour']))
	return false;
    if(!is_all_nnan([r['x'],r['y'],r['tile_width'],r['margin_r'],r['margin_b'],r['padding_x'],r['padding_y']])){
	set_error("Number field values must be integers, such as 12 or 31.");
	return false;
    }
    
    if(!validate_colour(r['background']) || !validate_colour(r['text_colour']))
	return false;
    return true;
}

function set_queue_options(r) {
    full_chart_queue["background"] = r['background'];
    full_chart_queue["text_colour"] = r['text_colour'];

    if(!full_chart_queue.hasOwnProperty('style')){
	full_chart_queue["style"] = r['style'];
	full_chart_queue["tile_width"] = r["tile_width"];
	full_chart_queue["x"] = r["x"];
	full_chart_queue["y"] = r["y"];
    }
    
    full_chart_queue["margin_r"] = r["margin_r"];
    full_chart_queue["margin_b"] = r["margin_b"];
    full_chart_queue["padding_x"] = r["padding_x"];
    full_chart_queue["padding_y"] = r["padding_y"];
    full_chart_queue["with_text"] = r["with_text"];
}

function begin(r) {
    console.log("r is "+r);
    if(r==0){
	r = r_values_from_form();
    }
    console.log(validate_r(r));
    if(validate_r(r)){
    
    var tpl = r['style']

    hide_thing(u("#chart_section_new_area"));
    //show_thing(u('#user_chart_section_save_area'));
    show_thing(u('#chart_section_export_area'));
    hide_thing(u('#chart_section_import_area'));
    show_thing(u('#chart_section_delete_area'));
    show_thing(u('#search_section'));
    
    if(tpl=="topsters2"){
	u("#topsters2_tpl").attr('class', ''); // unhide the topsters template
	tiles_and_rows = u("#topsters2_tpl").find('div').nodes;
    } else if(tpl=="top42"){
	u("#top42_tpl").attr('class', ''); // unhide the topsters template
	tiles_and_rows = u("#top42_tpl").find('div').nodes;
    } else if(tpl=="axb"){
	u("#axb_tpl").attr('class', ''); // unhide the topsters template
	var s = "";
	var b;
	var display_width = r['tile_width'];
	display_width = parseInt(Math.ceil(0.6*r['tile_width']));
	console.log(display_width);
	for(b=0; b<r['y']; b++){
	    s = s+"<div class=\"t"+display_width+"\">";
	    var a;
	    for(a=0; a<r['x']; a++){
		s = s+"<div></div>";
	    }
	    s = s+"</div>"
	}
	u("#axb_tpl").append(s);
	tiles_and_rows = u("#axb_tpl").find('div').nodes;
    }
    else
    {
	set_error("Could not create template; unknown style.");
	return false;
    }

	set_queue_options(r);
	set_options(r);

    tiles = tiles_and_rows.filter(function(e){return e.className.substring(0,1)!="t"});
    var index;
    for(index=0; index<tiles.length; ++index){
	var parent_width = tiles[index].parentElement.classList[0].substring(1);
	tiles[index].className = "m"+index;
	tiles[index].className += " tile";
	/*tiles[index].style = "width:"+parent_width+"px;height:"+parent_width+"px; max-width:"+parent_width+"px; max-height:"+parent_width+"px;";
	if(tpl=="axb")
	tiles[index].style['margin-rigt'] = r["margin_r"] +";";*/
	tiles[index].style['width'] = parent_width+"px";
	tiles[index].style['height'] = parent_width+"px";
	tiles[index].style['max-width'] = parent_width+"px";
	tiles[index].style['max-height'] = parent_width+"px";
	if(tpl=="axb"){
	    tiles[index].style['margin-right'] = r["margin_r"]+"px";
	    tiles[index].style['margin-bottom'] = r["margin_b"]+"px"; }
	tiles[index].setAttribute('onclick', 'javascript:edit_tile('+index+')');
	tiles[index].setAttribute('oncontextmenu', 'javascript:swap(event, '+index+')');
    }
    u("#search_form").attr('class', '');
    u("#new_chart_op").attr('class', 'hidden');
    u("#importbutton").attr('class', 'hidden');
    }
}

function select_tile(n) {
    show_thing(u("#tile_section"));
    var p = u(".selected").nodes;
    for(var i=0; i<p.length; i++){
	p[i].classList.remove('selected');
    }
    u(".m"+n).nodes[0].className += " selected";
    pos = n;
    is_selected = true;
    selected_pos = n;
}

function edit_tile(n) {
    select_tile(n);

    if(full_chart_queue[n]){
	u("#edit_tile_artist-album").html(full_chart_queue[n].artist + " - "+full_chart_queue[n].album);
	document.getElementById('edit_tile_move_id').value = n;
	u("#edit_tile_artist").nodes[0].value = full_chart_queue[n].artist;
	    
    } else {
	u("#edit_tile_artist-album").html("");
	document.getElementById('edit_tile_move_id').value = null;
	u("#edit_tile_artist").nodes[0].value = "";
    }
}

function edit_tile_delete() {
    var p = u(".m"+selected_pos).html('');
    delete full_chart_queue[selected_pos];
    delete chart_queue[selected_pos];
    hide_thing(u("#tile_section"));
    find_and_select_next();
}

function swap(e, n) {
    e.preventDefault();
    // replace a with b
    var a_n = document.getElementsByClassName("m"+selected_pos)[0];
    var b_n = document.getElementsByClassName("m"+n)[0];
    var a = document.getElementsByClassName("m"+selected_pos)[0].childNodes[0];
    var b = document.getElementsByClassName("m"+n)[0].childNodes[0];
    if(a){ var a_style = a.style.cssText; }
    if(b){ var b_style = b.style.cssText; }
    
    //alert(n);
    if(is_selected) {
	if(a && b){
	    console.log("a style is "+a_style+" and b style is "+b_style);
	    //b.style.cssText = a_style;
	    var replaced = a_n.replaceChild(b, a);
	    //replaced.style.cssText = b_style;
	    b_n.appendChild(replaced);
	    var aq = full_chart_queue[selected_pos];
	    var bq = full_chart_queue[n];
	    var tmp = aq;
	    full_chart_queue[selected_pos] = bq;
	    full_chart_queue[n] = tmp;
	    
	    aq = chart_queue[selected_pos];
	    bq = chart_queue[n];
	    tmp = aq;
	    chart_queue[selected_pos] = bq;
	    chart_queue[n] = tmp;

	    edit_tile(n);
	}
	else if(a && !b) {
	    b_n.appendChild(a);
	    //a_n.removeChild(a);
	    console.log(full_chart_queue[n]);
	    full_chart_queue[n] = full_chart_queue[selected_pos];
	    delete full_chart_queue[selected_pos];
	    console.log(full_chart_queue[n]);
	    //b_n.childNodes[0].style.cssText = a_style;

	    edit_tile(n);
	}
	else if(b && !a) {
	    a_n.appendChild(b);
	    //b_n.removeChild(b);
	    full_chart_queue[selected_pos] = full_chart_queue[n];
	    delete full_chart_queue[n];
	    //a_n.childNodes[0].style.cssText = b_style;

	    edit_tile(selected_pos);

	}
	else if(!b && !a) {}
	return false;
    }
}

function search_albums() {
    var term = document.getElementById('asearch').value;
    var asearch_db = document.getElementById('asearch_db').checked ? "1" : "0";
    var asearch_lfm = document.getElementById('asearch_lfm').checked ? "1" : "0";
    var asearch_discogs = document.getElementById('asearch_discogs').checked ? "1" : "0";
    var url = "/search/"+term+"/"+asearch_discogs+asearch_lfm+asearch_db+"/1";
    
    var options = { };
    var after = function(err, data){
	if(err){set_error(err);} else {
	    if(data.hasOwnProperty("error")){
		set_error(data['error']);
	    } else {
		u('#album_results').html('');
		data = data['covers'];
		var index;
		for (index = 0; index < data.length; ++index) {
		    console.log(data[index]["thumb"]);
		    var album_item = u('<a>').addClass('album_thumb_link').attr({
			href: 'javascript:queue("'+data[index]["id"]+'")',
			id: 'a'+data[index]["id"],
			thumb: data[index]["thumb"],
			image: data[index]["img"],
			artist: data[index]["artist"],
			album: data[index]["album"],
			inf: data[index]["inf"]
		    });
		    var pre="/thumb/";
		    if(data[index]["img"].substring(0, 4) == "http"){
			pre=""
		    }
		    album_item.html('<img class="album_thumb_link_image" width=120 height=120 src="'+pre+data[index]["thumb"]+'" />');
		    u('#album_results').append(album_item);
		}
	    }
	}
    };
    var before = function(xhr){};
    
    ajax(url, options, after, before);
}

function queue(id) {
    // add the album specified in the provided ID to the queue
    var c = u('#a'+id);
    var img = c.attr('image');
    var artist = c.attr('artist');
    var album = c.attr('album');
    var inf = c.attr('inf');
    var thumb = c.attr('thumb');
    if(img.substring(0, 4) === "http"){
	var url = "/new_album_url";
	
	var options = {
	    'body': JSON.stringify({'id': id,
				    'img': img,
				    'album': album,
				    'artist': artist,
				    'thumb': thumb,
				    'inf': inf}),
	    'method': 'POST'
	};
	
	var after = function(err, data){
	    if(err){
		set_error(err);
	    } else {
		console.log(data);
		artist = data['artist'];
		album = data['album'];
		inf = data['inf'];
		img = data['img'];
		thumb = data['thumb'];
		append_album_queue(id, artist, album, inf, img, thumb, "n");
	    }
	    if(data.hasOwnProperty('error')){
		set_error(data['error']);
	    }
	}

	var before = function(xhr){};
	
	ajax(url, options, after, before);
    } else {
	append_album_queue(id, artist, album, inf, img, thumb, "n");
    }
}

function set_options(r) {
    if(r==0)
	r = r_values_from_form();
    else
    {
	document.getElementById("background_val").value = r['background'];
	document.getElementById("text_colour").value = r['text_colour'];
	document.getElementById("padding_x").value = r['padding_x'];
	document.getElementById("padding_y").value = r['padding_y'];
	document.getElementById("margin_r").value = r['margin_r'];
	document.getElementById("margin_b").value = r['margin_b'];
    }
    if(validate_r(r)){
	console.log("r validates");
	set_queue_options(r);
	u("#background_val").nodes[0].style['background-color'] = r['background'];
	u("#main-copy").nodes[0].style['background-color'] = r['background'];
    } else {
	set_error("There was a problem setting options. Please check that the options are valid.");
    }
    
}

function append_album_queue(id,artist,album,inf,img,thumb,place){
    if(!isNaN(place)){
	place = parseInt(place, 10);
	var cur_class = "m"+place;
	pos = place;
    } else {
	var cur_class = "m"+pos;
    }
    chart_queue[pos] = id;
    full_chart_queue[pos] = {'id':id,
			     'artist':artist,
			     'album':album,
			     'inf':inf,
			     'img':img,
			     'thumb':thumb};
    var cur_tile = tiles.filter(function(e){return e.className.substring(0,cur_class.length)==cur_class})[0];
    console.log(cur_tile);
    var w = cur_tile.parentElement.classList[0].substring(1);
    cur_tile.innerHTML = '<img src="/img/'+img+'" style="max-width:inherit;max-height:inherit;"/>';

    find_and_select_next();
}

function is_free(space) {
    return !full_chart_queue.hasOwnProperty(space);
}

function find_and_select_next(){
    if (is_free(pos+1) && pos+1 < tiles.length){
	console.log("pos+1 free and pos+1 < t.l");
	pos = pos+1;
	select_tile(pos);
    } else {
	// find first available tile
	var index;
	for(index=0; index<tiles.length; index++){
	    if(is_free(index)){
		console.log(index+" is first free tile")
		select_tile(index);
		return true;
	    }
	}
    }
}

// function append_album_queue(id, artist, album, inf, img, thumb, place) {
//     console.log(pos);
//     // i'm pretty sure the images are supposed to be relative paths by now
//     var prefix = "/img/";
//     var succ=false;
//     if(img.substring(0, 4) === "http"){
// 	prefix="";
//     }
//     var ap = '<div class="album_queue_item"><img src="'+prefix+img+'" width=200 height=200 /><h3>'+artist+' - '+album+'</h3>Position: '+pos+'</div>';
//     var inc_pos = false;
//     if(isNaN(place)) {
// 	// we just want to place at the first available space
// 	console.log(chart_queue);
// 	if(!chart_queue.hasOwnProperty(pos)){
// 	    var cur_class = "m"+pos;
// 	    console.log(cur_class);
// 	    inc_pos=true;
// 	    succ=true;
// 	} else if(full_chart_queue.hasOwnProperty(pos) && is_selected && selected_pos == pos){
// 	    var cur_class = "m"+pos;
// 	    console.log(cur_class);
// 	    inc_pos=true;
// 	    succ=true;
// 	}
// 	else {
// 	    // if the space we want to write to is already occupied
// 	    if(!chart_queue.hasOwnProperty(pos+1)){
// 		var cur_class = "m"+pos+1;
// 		inc_pos=true;
// 		succ=true;
// 	    }
// 	    var index;
// 	    var found=false;
// 	    var found_second = false;
// 	    var has_empty = false;
// 	    for(index=0; index<tiles.length; ++index) {
// 		// find first available tile
// 		if(!chart_queue.hasOwnProperty(index)){
// 		    console.log("queue does not have property: "+index);
// 		    has_empty = true;
// 		    if(!found){
// 			console.log("not found");
// 			var cur_class = "m"+index;
// 			found = true;
// 			pos = index;
// 			succ=true;
// 			break;
// 		    } else {
// 			// set the next position to the next free one
// 			if(!found_second){
// 			    pos = index;
// 			    found_second=true;
// 			}
// 		    }
// 		}
// 	    }
// 	    if(!has_empty){
// 		set_error("No empty spaces were found on the chart.");
// 		succ=false;
// 	    }
// 	}
//     } else {
// 	place = parseInt(place, 10);
// 	var cur_class = "m"+place;
// 	pos = place;
// 	if(pos==place) { inc_pos=true; }
// 	succ=true;
//     }
//     if(succ){
// 	chart_queue[pos] = id;
// 	full_chart_queue[pos] = {'id':id,
// 				 'artist':artist,
// 				 'album':album,
// 				 'inf':inf,
// 				 'img':img,
// 				 'thumb':thumb};
// 	var cur_tile = tiles.filter(function(e){return e.className.substring(0,cur_class.length)==cur_class})[0];
// 	console.log(cur_tile);
// 	var w = cur_tile.parentElement.classList[0].substring(1);
// 	//cur_tile.innerHTML = '<img src="/img/'+img+'" width='+w+' height='+w+' onclick="edit_tile('+pos+')" oncontextmenu="swap('+pos+')"/>';
// 	cur_tile.innerHTML = '<img src="/img/'+img+'" style="max-width:inherit;max-height:inherit;"/>';
//     }
//     if(inc_pos){
// 	pos=pos+1;
//     }
// }

function toggle_up_form(){
    u('#up_form').toggleClass("hidden");
}

function album_up_form(){
    var cover = document.getElementById('up_form_cover').files[0];
    var info = u('#up_form_info').first().value;
    console.log(info);
    var artist = u('#up_form_artist').first().value;
    var album = u('#up_form_album').first().value;
    console.log(cover);
    var action = '/new_album';
    var formData = new FormData();
    formData.append('artist', artist);
    formData.append('album', album);
    formData.append('info', info);
    formData.append('cover', cover); 
    var options = {
	method: 'POST',
	body: formData,
	//headers: {"Content-Type": "multipart/form-data"}
    };
    var after = function(err, data){
	if(err) { set_error(err); }
	else {
	    console.log(data);
	    append_album_queue(data["id"], data["artist"], data["album"], data["inf"], data["img"], data["thumb"], "n");
	}
    };
    var before = function(xhr){};
    
    ajax(action, options, after, before);
}

function submit() {
    var action = '/make_chart';
    var options = {
	method: 'POST',
	body: {'template': 'top42',
	       'chart_vals': chart_queue},
    };
}

