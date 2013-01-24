/*
 * Connects the router and theme for Turbo setup
 * Setup similar to a plugin.
 */

/**
 * Major dependencies
 */

	// Node
var path = require('path'),
	crypto = require('crypto'),

	// JS Extensions
	_ = require('underscore'),
	
	// Specific
	Turbo = require('./turbo'),
	Router = require('./router'),
	Theme = require('./theme/'),
	Asset = require('./theme/asset'),
	mime = require('mime');

/**
 * Let's do some setup!
 */

// Fresh Theme instance
var theme = new Theme(Turbo.defaults().SYSTEM_PATHS.THEME, Turbo.config.get("theme"));

// Let's cache some assets
var statics = {};
theme.on("new_layout", function(layout) {
	var pu = function(asset) {
		var group = _.has(asset, "group") ? asset.group : "";
		return path.join("/assets", layout.uuid, group, asset.name);
	}
	
	// First set a new public url function if hasn't already been set
	if (!_.isFunction(layout.public_url)) layout.set_public_url(pu);
	
	// Now let's catch any state changes
	layout.on("state_change", function(state, old) {
		// Changed to ready state from preparing? let's cache
		if (old === "preparing" && state === "ready") {
			var groups = { "scripts": [ "javascript" ], "styles": [ "css" ] },
				self = this;
	
			_.each(groups, function(types, group) {
				// Okay let's get all the assets
				var assets = self.get_asset(group);
				
				_.each(assets, function(asset) {
					// Check asset is an Asset and push
					if (asset instanceof Asset && _.indexOf(types, asset.type) > -1) {
						statics[path.join(self.uuid, group, asset.name)] = asset;
					}
				});	
			});
		}
	});
});

// New Error layout
var error_layout = theme.new_layout_by_type("error");
if (error_layout) error_layout.do_action("precompile"); // Precompile because we can

// Fresh Router instance
var router = new Router({
	// HTTP Port
	port: Turbo.config.get('port') || 9000,
	
	// Link up error stuff
	error_handler: function(err, req, res, next) {
		var data = { title: "Error", status: 500, message: err.message };

		// Let's attempt to get some basic info
		if (_.has(req, "route") && _.has(req.route, "data")) _.extend(data, req.route.data);
		
		// Silently warn
		console.warn(err.stack);

		// Send some html
		if (error_layout) res.send(data.status, error_layout.compile(data));
		else return res.send(data.status, err.message); // Old fashion method
	}
});

// Generic json route
router.register_forward("json", function(req, res) {
	res.json(req.route.data);
});

// Link up theme static files
router.register_system_route('/assets/*', function(req, res) {
	if (_.isArray(req.route.match) && req.route.match[1]) {
		var route = req.route.match[1],
			asset = null;
		
		// First check the statics for the route
		if (_.has(statics, route)) asset = statics[route];
		
		// Next see if the theme has it "statically"
		else asset = test.new_static_asset(route);
		
		if (asset instanceof Asset) {
			var content = asset.toString(),
				type = mime.lookup(asset.name);
		
			// First have the router cache it so it loads super fast
			// No expiration because they shouldn't be editted
			router.cache_route(req.route.pathname, content, type);
		
			// Send it to the browser
			res.type(type);
			return res.send(content);
		}
	}
	
	// Error when all else fails
	req.route.throw_error("Sorry, that file couldn't be found.", 404);
});

// Finally, tell Turbo about the new instances
Turbo.router = router;
Turbo.theme = theme;