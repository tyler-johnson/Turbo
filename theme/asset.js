/**
 * Major dependencies
 */

	// Node
var fs = require('fs'),
	path = require('path'),
	url = require('url'),

	// JS Extensions
	_ = require('underscore'),
	sugar = require('sugar'),
	classy = require('../classy'),
	Class = classy.Class,
	EventClass = classy.EventClass,
	
	// Specific
	request = require('request'),
	promise = require('fibers-promise'),
	helper = require('../helper'),
	Turbo = require('../turbo');


/**
 * Asset Class
 *
 * Basic theme asset class with utility!
 */

var Asset = Class.$extend({
	
	// Initiate; give it an `AssetObject` (which is base data assets are made from)
	__init__: function( AssetObject, options ) {
		// Load the options
		this.options =_.extend({
			type: "text",
			base_cache_path: "__turbo::theme_assets"
		}, options);
		
		// Defaults
		this.type = this.options.type;
		this.file = "";
		this.name = null;
		this.location = null;
		
		// Generate a UUID
		this.uuid = helper.generate_uuid();
		
		// Set up cache
		this.cache = Turbo.redis;
		
		// Make the asset
		this._process_data(AssetObject);
	},
	
	cache_path: function() {
		// Validate
		if (!this.location) throw new Error("A location is needed before saving.");
		if (!this.uuid) throw new Error("Asset has no UUID.");
		
		// Construct the location
		var segs = helper.depatherize(this.location, "::");
		segs.push(this.uuid);
		return helper.patherize(segs, "cache");
	},
	
	toObject: function(omit) {
		var obj = {
			type: this.type,
			file: this.file,
			name: this.name,
			location: this.location,
			content: this._get(),
			options: this.options
		};
		
		return _.omit(obj, _.toArray(arguments));
	},
	
	toBuffer: function() {
		return this._get();	
	},
	
	toString: function(encoding) {
		if (!encoding) encoding = 'utf8';
		return this._get().toString(encoding);
	},
	
	clone: function() {
		return new Asset(this.toObject());
	},
	
	// Write data to asset; safe prevents overwriting
	write: function(content, safe) {
		return this._save(content, safe ? "safe" : "overwrite");
	},
	
	// Write data to the end of asset
	append: function(content) {
		return this._save(content, "append");
	},
	
	// Destroy removes this asset from cache
	// Should be considered unusable after this is called
	destroy: function() {
		var p = promise.t();
		this.cache.del(this.cache_path(), p);
		p.get();
	},
	
	add_content: function() {
		throw new Error("Depreciated.");
	},
	
	// Process some incoming asset data
	_process_data: function( data ) {
		// Is a string?	Must be a filename or content
		if (_.isString(data)) {
			// Check if it's a path to a real file
			if (fs.existsSync(data) && fs.statSync(data).isFile()) data = { file: data };
			else data = { content: data };
		}
		
		// Is an object?
		if (_.isObject(data)) {
			var content;
		
			// First, load the options; this will overwrite any previously set options
			if (_.isObject(data.options)) _.extend(this.options, data.options);
			
			// Load the asset type
			if (_.isString(data.type) && data.type) this.type = data.type;
		
			// Let's load the file name if it is manually set
			if (_.isString(data.name)) this.name = data.name;
		
			// Next, let's load the file path data
			if (_.isString(data.file)) {
				this.file = data.file;
				
				// Set the name if it isn't already set
				if (!this.name) this.name = path.basename(this.file);
			}
			
			// Give it a random name if it isn't already set
			if (!this.name) this.name = helper.rand_hex(32);
			
			// Now some content; if content is set, use that; we don't care what it is
			if (data.content) content = data.content;
			
			// Otherwise let's get it!
			else content = this._read_file();
			
			// Load up the cache location
			var segs = helper.depatherize(this.options.base_cache_path, "::");
			if (_.isString(data.location)) segs = helper.depatherize(data.location, "::");
			this.location = helper.patherize(segs, "cache");
			
			// Save to the cache
			if (content) this._save(content, "overwrite");
			
		// Otherwise toss somethin' nasteh-like
		} else throw new Error("Asset couldn't be properly initialized. Invalid AssetObject.");
	},
	
	// This function retrieves and reads the file from the disk. Doesn't modify the asset
	_read_file: function() {
		if (this.type === "static" || !this.file) return null;
		
		// Parse the file path
		var p = promise.t(),
			uri = url.parse(this.file),
			content;
			
		//console.log(this.file);
		
		// File is remote; retrieve it
		if (_.has(uri, "host") && _.has(uri, "protocol")) {
			request(this.file, p);
			var res = p.get();
			
			// Check response status...
			if (res[0].statusCode >= 400) throw new Error("Remote asset could not be retrieved. [status code "+res[0].statusCode+"]");
			else content = res[1]; // ...and set the content
	
		// File is local and exists; use that
		} else if (fs.existsSync(this.file) && fs.statSync(this.file).isFile()) content = fs.readFileSync(this.file);
			
		// Otherwise wtf is this file thing?
		else throw new Error("Asset file path `"+this.file+"` is invalid or doesn't exist.");
		
		return content;
	},
	
	// This takes content and saves it to the cache
	// Modes: overwrite, safe, append
	_save: function(content, mode) {
		var p = promise.t(), set;
		
		// Validate
		if (_.isString(content)) content = new Buffer(content);
		if (!Buffer.isBuffer(content)) throw new Error("Content should be a buffer or string.");
		
		// Append if need be
		if (mode === "append") content = Buffer.concat([this._get(), content]);
		
		// Convert
		content = content.toString("base64");
		
		// Now get the right function
		switch(mode) {
			case "append":
			case "overwrite":
				set = this.cache.set;
				break;
			
			case "safe":
			default:
				set = this.cache.setnx;
				break;
		}
		
		// Set it!
		set.call(this.cache, this.cache_path(), content, p);
		return p.get() ? true : false;
	},
	
	// Loads the content from the cache
	_get: function() {
		if (!this.location) return new Buffer("");
		
		var p = promise.t();
		this.cache.get(this.cache_path(), p);
		return new Buffer(p.get() || "", "base64");
	}
	
});

module.exports = Asset;