/**
@module Turbo
**/

/**
Provides Turbo with general helper functions. All methods are attached directly to `module.exports`.

	var helper = require('turbo/helper');

@class Helper
**/

/* Major Dependencies */

	// Node
var // None

	// JS Extensions
	_ = require('underscore'),
	sugar = require('sugar'),
	
	// Specific
	promise = require('fibers-promise'),
	uuid = require('node-uuid');

/**
Parses `options` according to `rules` and returns an adjusted copy.

@method parse_options

@param {Object} options The options to parse. Should be in standard key, value format.
@param {Object} rules Rules the `options` should follow. Values in `rules` can be either an Object or Array. Each has different use.
	@param {Object} rules.nested_rules If a `rule` value is an object and the `options` value is an object, this method recursively calls itself on these objects.
	@param {Array} rules.rule If a `rule` value is an array, it is tested against `options`.
		@param {String} rules.rule.0 The first value in the array is the type to match to the current `options` value by.
		@param {Mixed} rules.rule.1 The second value in the array is the default value to use if an incorrect type is found.
		@param {Boolean} [rules.rule.2] The third value in the array tells this method to throw an Error if an incorrect type is found. Set the second array value to null if this is true.
		
@return {Object} An object similar to `options`, adjusted to match `rules`.

@example
	var options = {
		TEST: {
			FOO: "BAR"
		},
		PARAM: true
	};
	
	var rules = {
		TEST: {
			FOO: ["string", "default"],
			OTHER: ["number", 100]
		}
		PARAM: ["boolean", null, true]
	}
	
	var config = helper.parse_options(options, rules);
	
The above example returns:

	{
		TEST: {
			FOO: "BAR",
			OTHER: 100
		},
		PARAM: true
	}	
**/
var parse_options = module.exports.parse_options = function(options, def) {
	var fine = {};
	
	// Validate
	if (typeof options !== "object") throw new Error("Invalid options argument.");

	// Loop through the default object
	_.each(def, function(item, key) {
		// Array? Then it wants to set up.
		if (item instanceof Array && item.length >= 2) {
			// Check if options has the key and is the right type; use that
			if (_.has(options, key) && typeof options[key] === item[0]) fine[key] = options[key];

			// Check if the third parameter is true -> get out
			else if (item[2] === true) throw new Error("Option `"+key+"` is not the right type.");
			
			// Otherwise, load the default
			else  fine[key] = item[1];

		// Otherwise its an object of more keys
		} else if (typeof def[key] === "object" && typeof options[key] === "object") fine[key] = parse_options(options[key], def[key]);

		// Not an object? Get outta here.
		else throw new Error("Invalid default.");
	});
	
	return fine;
}

/**
Generates a random hexadecimal string of n digits long.

@method rand_hex

@param {Number} n The length of the returned hexadecimal string.

@return {String} A random hexadecimal string.
**/
var rand_hex = module.exports.rand_hex = function( n ) {
	if (!n) n = 6;
	var val = "";
	
	_.times(n, function() {
		val += Math.floor(Math.random() * 16).toString(16);
	});
	
	return val;
}

/**
Generates a new RFC4122 v4 universally unique identifier. Internally uses [node-uuid](https://github.com/broofa/node-uuid/).

@method generate_uuid

@return {String} A universly unique string of 32 character long.
**/
var generate_uuid = module.exports.generate_uuid = function() {
	return uuid.v4();
}

/**
Takes a string or array of strings and converts it into a usable path. The inverse of this method is `helper.depatherize()`.

@method patherize

@param {Array|String} segments An array of segments to join together into a path. If a string is given, it is first processed with `helper.depatherize()`.
@param {Object|String} options If options is an Object, it is used in place of the defaults. If a string is given, this method will search for it in a set of preset option keys. Currently, there are three presets: `cache`, `file`, and `url`.
	@param {String} [options.sep=/] A string to seperate segments by.
	@param {Boolean} [options.root=true] Include a seperator at the beginning of the path.
	@param {Boolean} [options.strict=false] If true, returns null on invalid parts instead of skipping over.
	@param {RegExp|Function} [options.match] If a regular expression is found, it is matched against each segment for validity. If a function is found, it is called on each segment individually. If it returns a string, the segment is replaced by it. Otherwise, the function's return value is evaluated to be true or false. This options defaults to a function that returns a [SugarJS Parameterized](http://sugarjs.com/api/String/parameterize) string.
	
@return {String} A usuable path

@example
	helper.patherize("//my/really/screwed)(*&\\\\^%$#@Q!/path/") // /my/really/screwed/path
	helper.patherize(["my","super","cache","path"], "cache") // my::super::cache::path
**/
var patherize = module.exports.patherize = function( segments, options ) {
	var loop;
	
	var defs = {
		"cache": { sep: "::", root: false },
		"url": { strict: true },
		"file": {}
	}
	
	if (_.isString(options) && _.has(defs, options)) options = defs[options];
	if (!_.isObject(options)) options = {};
	
	// Set up options
	_.defaults(options, {
		sep: "/",
		root: true,
		strict: false,
		match: function(seg) { return seg.parameterize(); }
	});
	
	// Validate segments
	if (_.isString(segments)) segments = depatherize(segments, options.sep, true);
	if (!_.isArray(segments)) throw new Error("Segments should be a string or array.");
	
	if (options.strict) loop = _.some;
	else loop = _.each;
	
	// Loop through segments; if it returns true that something went wrong
	if (loop(segments, function(seg, key) {
		var test;
		
		// Make sure segment is a string or get out
		if (!_.isString(seg)) return true;
		
		// Test the segment
		if (_.isRegExp(options.match)) test = seg.match(options.match);
		else if (_.isFunction(options.match)) test = options.match.call(null, seg);
		else test = true;
		
		// If it validates to false
		if (!test) {
			// If strict, gtfo
			if (options.strict) return true;
			
			// Otherwise "mark" for deletion
			segments[key] = null;
		
		// Otherwise test it as a string for replacing
		} else if (_.isString(test)) segments[key] = test;
	})) return null;
	
	// Return a brand new path
	return (options.root ? options.sep : "") + _.compact(segments).join(options.sep);
}

/**
Takes a string and seperates it into an array of segments. The inverse of this method is `helper.patherize()`.

@method depatherize

@param {String} path A string that needs to be seperated into basic segments.
@param {String} [sep=/] A string to split the `path` by.
@param {Boolean} [strict=false] If true, it keeps any segments that would normally evaluate to false. 

@return {Array} The original path, split into an array of strings.

@example
	helper.depatherize("//my/really/screwed)(*&\\\\^%$#@Q!/path/", "/", true) // ["", "my", "really", "screwed)(*&\\\\^%$#@Q!", "path"]
	helper.depatherize("my::super::cache::path", "::") // ["my","super", "cache", "path"]
**/
var depatherize = module.exports.depatherize = function( path, sep, strict ) {
	// Validate
	if (!_.isString(path)) throw new Error("Path should be a string.");
	if (!_.isString(sep)) sep = "/";
	if (!_.isBoolean(strict)) strict = false;
	
	// Trim the path of starting or ending segments
	path = path.trim();
	if (path.substr(0, sep.length) === sep) path = path.substr(sep.length);
	if (path.substr(-1 * sep.length) === sep) path = path.substr(0, path.length - sep.length);
	
	// Split the path
	var segments = path.split(sep);
	
	// If strict, just return what we found, otherwise compact the array
	if (strict) return segments;
	else return _.compact(segments);
}