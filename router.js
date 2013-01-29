/**
 * Major dependencies
 */

	// Node
var fs = require('fs'),
	path = require('path'),
	http = require('http'),
	url = require('url'),

	// JS Extensions
	sugar = require('sugar'),
	_ = require('underscore'),
	classy = require('./classy'),
	Class = classy.Class,
	EventClass = classy.EventClass,
	
	// Specific
	promise = require('fibers-promise'),
	mongoose = require('mongoose'),
	express = require('express'),
	helper = require('./helper'),
	Turbo = require("./turbo");

/**
 * Simple Route Class
 */

var Route = Class.$extend({

	__init__: function(pathname) {
		// Just some defaults to set later
		this.pathname = pathname || "";
		this.handle = null;
		this.type = "system";
		this.data = null;
		this.params = {};
		this.match = null;

		// Render some segments if we can
		this._render_segments();
	},

	param: function(key) {
		if (_.isObject(this.params) && _.has(this.params, key)) return this.params[key];
		else return false;
	},

	segment: function(n) {
		n -= 1; // Normalize n
		return this.segments[n] ? this.segments[n] : false;
	},
	
	throw_error: function(message, status) {
		this.data.status = status || 500;
		throw new Error(message);	
	},

	// Some "hidden" methods for constructing
	
	// Load some data
	_load: function(key, value) {
		if (_.isObject(key)) {
			_.each(key, _.bind(function(v, k) {
				this._load(k, v);
			}, this));
		} else {
			var valid = ["pathname", "handle", "type", "data"];
			if (_.indexOf(valid, key) !== -1) this[key] = value;
			
			// Rerender the segments if we should
			if (key === "pathname") this._render_segments();
		}
			
		// For chaining
		return this;
	},

	// Render path segments
	_render_segments: function() {
		if (!this.pathname) return;
		this.segments = _.compact(this.pathname.split("/"));
	},

	// Load up a match
	_load_params: function(keys, match) {
		// Validate
		if (!_.isArray(keys) || !_.isArray(match)) throw new Error("Both arguments should be arrays.");

		// Filter for only the match results
		var matches = _.filter(match, function(item, key) { if (key) return true; }); 

		// Make the params object, it's a little funky
		_.each(keys, _.bind(function(key, i) {
			this.params[key] = matches[i] ? matches[i] : null;
		}, this));

		// Finally load match
		this.match = match;

		// For chaining
		return this;
	}
});

/**
 * Main Router Class
 */

var Router = EventClass.$extend({

	// Initialize
	__init__: function(options) {
		// Call to super first so events are properly initialized
		this.$super();

		// Load the options
		this.options = _.defaults(options || {}, {
			logger: 'dev',															// Connect logger format
			collection: 'routes',													// MongoDB collection handle
			port: 9000,																// HTTP server port
			cache_key: 'routes',													// Name of cache
			error_handler: function(err, req, res, next) { res.end(err.message); }	// Basic error handling
		});

		// Open routes collection
		var schema = new mongoose.Schema({
			handle: mongoose.Schema.Types.Mixed,
			type: String,
			data: mongoose.Schema.Types.Mixed
		}, { collection: this.options.collection });

		this.routes = mongoose.model('Route', schema);
		
		// Basic vars
		this.cache = Turbo.redis;
		this.forwards = {};
		this.system_routes = [];

		// Initialize express
		var app = this.app = express();
		app.use(express.logger(this.options.logger));	// Basic logging
		app.use(express.bodyParser());					// REQUEST parser
		app.use(express.query());						// GET parser
	},

	// Load some middleware
	// This function is destroyed on server start
	use: function() {
		return this.app.use.apply(this.app, arguments);
	},

	// Forwards are callbacks for paths in the database, matched by their type
	register_forward: function(type, fnc) {
		// Validate and push
		if (_.isString(type) && _.isFunction(fnc)) this.forwards[type] = fnc;
	},

	// System paths are declared by JS, can be "dynamic"
	register_system_route: function(route, fnc) {
		var keys = [];

		// Validate the function or toss a wrench
		if (!_.isFunction(fnc)) throw new Error("Second argument should be a function.");

		// First, let's deal with the route.
		// Is it a string? Convert to regex.
		if (_.isString(route)) route = this._path_regex(this._clean_path(route), keys);
		if (!_.isRegExp(route)) throw new Error("First argument should be a path string or regex.");

		// Compose and push the system route
		this.system_routes.push({ handle: route, params: _.pluck(keys, "name"), callback: fnc });
	},

	// Finds the proper route and returns a route object
	get_route: function(route) {
		var p, R, sr, match, matches,
			params = {},
			exactq = { handle: route },
			fields = { _id: 0, type: 1, handle: 1, data: 1 };

		// Load up a new promise
		p = promise.t();

		// Clean the route
		route = this._clean_path(url.parse(route).pathname);
		if (!route) return false;

		// Create a new route object
		R = new Route(route);

		// First check system routes for a match
		if (_.size(this.system_routes)) {
			sr = _.find(this.system_routes, function(item) {
				// Try the handle for a match
				match = item.handle.exec(route);

				// If there's a match, do stuff
				if (match) {
					R._load_params(item.params, match);
					return true;
				} else return false;
			});

			if (sr) return R._load(sr)._load("data", sr.callback);
		}

		// Next check the database for a perfect match
		this.routes.count(exactq, p);
		if (p.get()) {
			this.routes.findOne(exactq, fields, p);
			var r = _.pick(p.get(), "handle", "type", "data");
			return R._load(r);
		}

		// Otherwise return an error route
		return R._load("type", "error")._load("data", { title: "Not Found", status: 404, message: "Not found." });
	},
	
	cache_route: function(route, content, headers, expires) {
		var p = promise.t();
		
		// Validate
		if (!_.isString(route)) throw new Error("Route should be a string.");
		
		if (_.isString(content)) content = new Buffer(content);
		if (!Buffer.isBuffer(content)) throw new Error("Content should be a buffer or string.");
		
		if (_.isNumber(headers)) {
			expires = headers;
			headers = {};
		}
		if (_.isString(headers)) headers = { "Content-Type": headers };
		if (!_.isObject(headers)) headers = {};
		if (!_.isNumber(expires)) expires = null;
		
		// Create a cache info
		var location = this.build_cache_location(route),
			data = _.chain({}).extend(headers, { content: content.toString('base64') }).map(function(val, key) {
				return [key, val];
			}).flatten().value();
		
		// Set
		data.unshift(location);
		this.cache.hmset(data, p);
		p.wait();
		
		if (expires) this.cache.expire(location, expires);
		
		return p.get() ? true : false;
	},
	
	get_cached_route: function(route) {
		var p = promise.t();
		
		// Validate
		if (!_.isString(route)) throw new Error("Route should be a string.");
		
		// Create a cache location
		var location = this.build_cache_location(route);
		
		// Get
		this.cache.hgetall(location, p);
		var data = p.get();
		
		if (data) {
			var content = _.has(data, "content") ? new Buffer(data.content, "base64") : "",
				headers = _.omit(data, "content");
			
			return { content: content, headers: headers };
		} else return null;
	},
	
	build_cache_location: function(route) {
		route = helper.depatherize(route);
		return helper.patherize(_.union(["__turbo", "routes"], route), "cache");
	},

	// Route logic
	load: function(req, res, next) {
		// FIIIIIIBBBEEEERRRRRR UUUUUPPPP!!!!
		promise.start(_.bind(function() {
			// Catch all for errors
			try {
				// Fire the load event
				this.trigger("load", req, res);

				// Current pathname
				var pathname = req.url;

				// Check the cache first
				var cached = this.get_cached_route(pathname);
				if (cached) {
					res.set(cached.headers);
					return res.send(cached.content);
				}

				// Otherwise get it the long way
				var route = req.route = this.get_route(pathname);
				
				// Decide what to do with this route
				switch (route.type) {
					// System route
					case "system":
						// Call the attached callback
						route.data.call(this, req, res, next);
						break;

					// Some error (can only be a 404 for now)
					case "error":
						// Create an error then toss it
						throw new Error(route.data.message);
						break;

					// Everything else
					default:
						// Check the type against the forwards and execute
						if (_.has(this.forwards, route.type)) this.forwards[route.type].call(this, req, res, next);
						else throw new Error("No forward setup for `"+route.type+"`");
						break;
				}
			} catch (e) {
				// Error event
				this.trigger("load_error", e);

				// Redirect errors to the right place
				next(e);
			}
		}, this));
	},
	
	// Fire up the router!
	start: function(cb) {
		// Some final connect stuff
		this.use(_.bind(this.load, this));
		this.use(this.options.error_handler);

		// Destroy `use` method so it can't be accessed again
		this.use = function() {};

		// Add callback to events
		if (typeof cb === "function") this.on("start", cb);

		// Make sure port is a number to prevent other uses of `server.listen`
		if (typeof this.options.port !== "number") throw new Error("Router starting port should be a number.");

		// New HTTP Server
		var server = this.server = http.createServer(this.app);

		// Server starting event
		this.trigger("starting");

		// Start listening
		server.listen(this.options.port, _.bind(function(err) {
			// Server started event
			this.trigger("start", err);
		}, this));
	},
	
	// Graceful shutdown
	close: function() {
		this.server.close();
		
		this.trigger("close");
	},

	// Helper functions

	// Tidy paths, Tyler style.
	_clean_path: function(path) {
		if (typeof path !== "string") return false;

		path = path.trim();
		while (path.substr(0,1) === "/") path = path.substr(1);
		while (path.substr(-1) === "/") path = path.substr(0, path.length-1);
		return "/" + path;
	},

	// String path to regex
	// Same as express.js (https://github.com/visionmedia/express/blob/master/lib/utils.js#L262-L282)
	_path_regex: function(path, keys, sensitive, strict) {
		if (_.isRegExp(path)) return path;
		if (_.isArray(path)) path = '(' + path.join('|') + ')';
		path = path
			.concat(strict ? '' : '/?')
			.replace(/\/\(/g, '(?:/')
			.replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?(\*)?/g, function(_, slash, format, key, capture, optional, star){
				keys.push({ name: key, optional: !! optional });
				slash = slash || '';
				return ''
					+ (optional ? '' : slash)
					+ '(?:'
					+ (optional ? slash : '')
					+ (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')'
					+ (optional || '')
					+ (star ? '(/*)?' : '');
			})
			.replace(/([\/.])/g, '\\$1')
			.replace(/\*/g, '(.*)');
		return new RegExp('^' + path + '$', sensitive ? '' : 'i');
	}

});

module.exports = Router;