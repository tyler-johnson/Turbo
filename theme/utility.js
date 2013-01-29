// This file loads some basic theme utility
// This includes things like Handlebar template helpers

/**
 * Major dependencies
 */

	// Node
var path = require('path'),
	fs = require('fs'),
	crypto = require('crypto'),

	// JS Extensions
	_ = require('underscore'),
	
	// Specific
	helper = require('../helper'),
	Turbo = require('../turbo');

/**
 * Handlebar
 */

var Handlebars = require('handlebars');

// Include Function
// Note: included files don't have access to local Template helpers, just their context.
Handlebars.registerHelper("include", function(file) {
	// Has the correct data?
	if (!_.has(this, "_asset") || !_.has(this._asset, "file")) return false;
	var dir = path.dirname(this._asset.file);

	// Check if the file exists
	file = path.join(dir, file);
	if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;

	// Load in html
	var html = fs.readFileSync(file).toString(),
		content = Handlebars.compile(html)(this);

	// Render with context
	return new Handlebars.SafeString(content);
});

Handlebars.registerHelper("title", function() {
	var name = Turbo.config.get("name"),
		title = this.title,
		ret = "";

	if (name) ret += name;
	if (name && title) ret += " - ";
	if (title) ret += title;

	return ret;
});

/**
 * Theme Helpers
 */
 
// Take JS assets and turns it into a single, minified string
var UglifyJS = require("uglify-js");
module.exports.minify_js = function() {
	// Get arguments
	var assets = _.flatten(_.toArray(arguments)),
		compressor = UglifyJS.Compressor({ warnings: false })
		toplevel = null;
	
	_.each(assets, function(asset) {
		toplevel = UglifyJS.parse(asset.toString(), { filename: asset.name, toplevel: toplevel });
	});
	
	toplevel.figure_out_scope();
	return toplevel.transform(compressor).print_to_string();
}

// Take CSS assets and turns it into a single, minified string
var sqwish = require('sqwish');
module.exports.minify_css = function() {
	// Get arguments
	var assets = _.flatten(_.toArray(arguments)),
		ret = "";
	
	_.each(assets, function(asset) {
		ret += sqwish.minify(asset.toString());
	});
	
	return ret;
}

// Concat assets of any type; be as non-desructive of the asset order as possible
module.exports.concat = function(assets) {
	var current = null,
		concatd = [];
		
	_.each(assets, function(asset) {
		var concat = true;
		
		// First check if we should concat; Static files are an automatic fail
		if (asset.type === "static") concat = false;
		
		// Check the asset options
		else if (_.isBoolean(asset.options.concat)) concat = asset.options.concat;
		
		// If concat is false; just push and return
		if (!concat) {
			if (current) {
				concatd.push(current);
				current = null;
			}
			
			concatd.push(asset.clone());
			return;
		}
		
		// Current not set? Let's create a new one from this asset
		if (!current) {
			current = asset.clone();
		
		// Otherwise
		} else {
			// Give it a new name because it will be getting multiple files, but it has to be able to duplicate the name
			current.file = current.name = crypto.createHash("md5").update(asset.name).digest("hex") + path.extname(asset.name);
			
			// Push the current asset's content into it
			current.append(asset.toString());
		}
	});
	
	// Push the last current asset onto the stack
	if (current) concatd.push(current);
	
	return concatd;
}

// Take a handful of assets and create HTML from them.
// This is great for js and css that needs to embeded
module.exports.asset_html = function(assets, options) {
	var html = "", src;
	
	_.defaults(options, {
		embed: false,
		embed_format: "{content}\n",
		src_format: "{src}\n",
		public_url: function(asset) { return path.join( "/assets", asset.name ); },
		match: function(asset) { return true; }
	});
			
	_.each(assets, function(asset) {
		var content = asset.toString(),
			test = true;
		
		// First "match" the asset
		if (_.isFunction(options.match)) test = options.match.call(null, asset);
		else if (_.isRegExp(options.match)) test = asset.file.match(match);
		if (!test) return;
		
		// Check if we should embed or not
		if (asset.type !== "static" && options.embed && content)
			html += options.embed_format.assign({ content: content });
		else {
			if (asset.type === "static" || !asset.name) src = asset.file;
			else src = options.public_url(asset);
			
			html += options.src_format.assign({ src: src });
		}
	});
	
	return html;
}