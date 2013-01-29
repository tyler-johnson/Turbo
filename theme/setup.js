// This file sets a global base for themes
// Not required but recommended for any functionality

/**
 * Major dependencies
 */

	// Node
var path = require('path'),
	fs = require('fs'),
	crypto = require('crypto'),

	// JS Extensions
	_ = require('underscore'),
	sugar = require('sugar'),
	
	// Specific
	promise = require('fibers-promise'),
	Asset = require('./asset'),
	util = require('./utility');

var theme_setup = function() {
	
	/*
	 * Theme file extensions and prefilters
	 */
	
	// HTML, Text, Images; Don't need a filter fnc because they don't process anything 
	this.register_asset_type("html", [ "html", "htm" ]);
	this.register_asset_type("text", "txt");
	this.register_asset_type("image", [ "png", "gif", "jpg", "jpeg" ]);
	this.register_asset_type("font", [ "ttf", "woff", "eot" ]);
	this.register_asset_type("svg", "svg");
	
	// Handlebar
	var Handlebars = require('handlebars');
	this.register_asset_type("handlebar", [ "handlebar", "hbr" ], function(asset) {
		// Precompile the handlebar template
		var content = Handlebars.compile(asset.toString());
		
		// Let's reconstruct this asset
		asset.type = "html";
		asset.name += ".html";
		
		// This function is not defined by the traditional asset set up
		// It will still attempt to be called during compile regardless
		asset.compile = content;
		
		return asset;
	});
	
	this.register_asset_type("css", "css", function(asset) {
		// Determine if we should minify; First check the asset options
		var minify = _.isBoolean(asset.options.minify) ? asset.options.minify : false;
		if (!minify && _.isBoolean(this.options.minify)) minify = this.options.minify; // Otherwise load normal options
		
		// Minify the css with Sqwish
		if (minify === true) asset.write(util.minify_css(asset));
		
		return asset;
	});
	
	this.register_asset_type("javascript", "js", function(asset) {
		// Determine if we should minify; First check the asset options
		var minify = _.isBoolean(asset.options.minify) ? asset.options.minify : false;
		if (!minify && _.isBoolean(this.options.minify)) minify = this.options.minify; // Otherwise load normal options
		
		// Minify the js with Uglify
		if (minify === true) asset.write(util.minify_js(asset));
		
		return asset;
	});
	
	// Less
	var less = require('less');
	this.register_asset_type("less", "less", function(asset) {
		var p = promise.t(),
			parser = new(less.Parser)({
				paths: [path.dirname(asset.file)], // Specify search paths for @import directives
				filename: asset.name
			}),
			content = asset.toString(), css;	
		
		// Determine if we should minify; First check the asset options
		var minify = _.isBoolean(asset.options.minify) ? asset.options.minify : false;
		if (!minify && _.isBoolean(this.options.minify)) minify = this.options.minify; // Otherwise load normal options
		
		// Render the less
		parser.parse(content, p);
		css = p.get().toCSS({ compress: minify });
		
		// Let's reconstruct this asset
		asset.type = "css";
		asset.name += ".css";
		asset.write(css);
		
		return asset;
	});
	
	/*
	 * Theme compile strategies
	 */
	
	// Content (mainly HTML)
	this.register_strategy("content", function(assets, options) {
		
		switch(this.state) {
			case "preparing":
				// In precompilation do nothing
				return assets;
				break;
			
			case "ready":
				// Check for context
				if (!_.isObject(options.context)) options.context = {};
			
				// Create a new blank asset
				var nasset = new Asset({
					name: "content",
					type: "html"
				});
				
				// During compilation, get context, render
				return [ _.reduce(assets, function(memo, asset) {
					var content = "";
					
					// Wrap this asset into the context
					var context = _.extend({}, options.context, {
						_asset: asset.toObject("content")
					})
				
					// Test asset for a compile function and run, otherwise get the content normally
					if (_.isFunction(asset.compile)) content = asset.compile.call(asset, context);
					else content = asset.toString();
					
					// Append the asset
					memo.append(content);
					return memo;
				}, nasset) ];
				
				break;
		}
		
	});
	
	// Scripts (mainly JS)
	this.register_strategy("scripts", function(assets, options) {
		
		// Setup options
		_.defaults(options, {
			concat: this.options.concat || false
		});
		
		switch(this.state) {
			case "preparing":
				// In precompilation we should do a non-destructive concatenation
				return options.concat ? util.concat(assets) : assets;
				break;
			
			case "ready":
				// During compilation, there shouldn't be anything to do
				return assets;
		}
		
	});
	
	// Styles (mainly CSS)
	this.register_strategy("styles", function(assets, options) {
		
		// Setup options
		_.defaults(options, {
			concat: this.options.concat || false
		});
		
		switch(this.state) {
			case "preparing":
				// In precompilation we should do a non-destructive concatenation
				return options.concat ? util.concat(assets) : assets;
				break;
			
			case "ready":
				// During compilation, there shouldn't be anything to do
				return assets;
		}
		
	});
	
	// Misc Headers
	this.register_strategy("headers", function(assets, options) {
		
		// Setup options
		_.defaults(options, {
			concat: this.options.concat || false
		});
		
		switch(this.state) {
			case "preparing":
				// In precompilation we should do a non-destructive concatenation
				return options.concat ? util.concat(assets) : assets;
				break;
			
			case "ready":
				// During compilation we should do a destructive concatenation (ie. everything should become one file regardless)
				var nasset = new Asset({
					name: "headers",
					type: "text"
				});
				
				return [ _.reduce(assets, function(memo, asset) {
					memo.append(asset.toString());
					return memo;
				}, nasset) ];
				
				break;
		}
		
	});
	
	/*
	 * Theme actions
	 */
	
	this.register_action("precompile", function(options) {
		// Set the state
		this.change_states("preparing");
		
		// Parse options
		options = this.parse_options(options);
		
		// Simple, loop through asset groups and execute their strategy.
		_.each(this.asset_groups, _.bind(function(data, group) {
			var opts = _.has(options, group) ? options[group] : {},
				assets = data.assets,
				nassets = this.execute(group, opts);
			
			// During precompile, assets are overwritten by the strategy return.
			// To prevent cache memory leak, this must loop through the current assets
			// and destroy anything that isn't in the new assets.
			_.each(assets, function(asset) {
				// Search for the asset in the current assets
				if (_.indexOf(nassets, asset) === -1) {
					// Destroy it
					asset.destroy();
				}
			});
			
			// Reset the assets array for the group and add all of the new assets
			this.remove_assets(group);
			this.add_asset(group, nassets);
		}, this));
		
		// Set the state
		this.change_states("ready");
	});
	
	// Turn a layout into some HTML
	this.register_action("compile", function(options) {
		// We don't set the state for caching reasons
		
		var parts = [ "styles", "scripts", "headers" ],
			rendered = {},
			context, content, compiled;
		
		// Parse options
		options = this.parse_options(options);
		
		// First compile the misc parts
		_.each(parts, _.bind(function(part) {
			var opts = _.has(options, part) ? options[part] : {};
			
			rendered[part] = this.execute(part, opts);
		}, this));
		
		// Set context if isn't already
		context = options.content.context;
		if (!_.isObject(context)) context = {};
		
		// Headers
		context.headers = _.size(rendered.headers) ? rendered.headers[0].toString() : "";
		
		// Styles
		context.styles = _.size(rendered.styles) ? util.asset_html(rendered.styles, {
			src_format: "<link rel=\"stylesheet\" href=\"{src}\" type=\"text/css\"/>\n",
			public_url: _.isFunction(this.public_url) ? this.public_url : null
		}) : "";
		
		// Scripts
		context.scripts = _.size(rendered.scripts) ? util.asset_html(rendered.scripts, {
			src_format: "<script src=\"{src}\" type=\"text/javascript\"></script>\n",
			public_url: _.isFunction(this.public_url) ? this.public_url : null
		}) : "";
		
		// Reset the context JIC
		options.content.context = context;
		
		// Compile
		content = this.execute("content", options.content);
		compiled = _.size(content) ? content[0].toString() : "";
		
		// Collect garbage
		_.invoke(rendered.headers, "destroy");
		_.invoke(content, "destroy");
		
		// Return
		return compiled;
	});
	
	/*
	 * Theme global assets
	 */
	 
	/*// Load the file
	var globals = JSON.parse(fs.readFileSync(path.resolve(__dirname, "./assets/globals.json")));
	
	// Loop through json file
	_.each(globals, _.bind(function(item, id) {
		// Process the item as an asset
		var asset = this.new_asset(item, path.resolve(__dirname, "assets"));
		
		// Add it to the theme
		this.add_global_asset(id, asset);
	}, this));*/
}

// Bind and execute
module.exports = function(Theme) {
	_.bind(theme_setup, Theme)();
};