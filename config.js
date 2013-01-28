// Load some major dependencies
var fs = require('fs'),
	_ = require('underscore'),
	Class = require('./classy').Class;

/**
 * Helper class for loading json files.
 * Mostly used as a configuration starter (hence the name).
 */
var Config = Class.$extend({

	__init__: function(file) {
		// Set base data
		this.data = {};
		
		try {
			// Check if the config file exists and parse it
			if (file) this.data = JSON.parse(fs.readFileSync(file));
		} catch (e) {
			// Silently toss any errors
			console.error(e.stack);
		}
		
		return this;
	},

	
	get: function(key) {
		// Is key array? use that shit
		if (_.isArray(key)) return this._find(key);
		
		// are there a ton of arguments? use that shit
		else if (arguments.length) return this._find(arguments);
		
		// otherwise wtf is this?
		else return undefined;
	},

	set: function(key, value) {
		// Load some arguments
		var args = _.toArray(arguments),
			current = this.data;
	
		// Next prep keys and value
		value = args.pop();
		key = args;
		
		// Traverse the tree. Stop right before the last key
		_.each(_.initial(key), function(item) {
			// If it doesn't exist, make it an object
			if (!_.has(current, item)) current[item] = {};
			
			// If it does exists, isn't the last key (can't be), and isn't an object, error up as a safety
			if (!_.isObject(current[item])) throw new Error("The key `"+item+"` exists, but setting the value failed because it isn't a traversable object.");
			
			// Reset the current variable
			current = current[item];
		});
		
		// Finally, set some bitches
		current[_.last(key)] = value;
	},
	
	equals: function(key, value) {
		// Load some arguments
		var args = _.toArray(arguments);
		
		// Next prep keys and value
		value = args.pop();
		key = args;
		
		return this._find(key) === value;
	},
	
	/* Internal method for getting a value with known keys. Returns undefined if keys are not present.
	 * 
	 * ie. Config._find(key1, key2, ...) -> this.data[key1][key2][...]
	 */
	_find: function(keys) {
		// Create a var to set
		var current = this.data;
		
		// Traverse the tree. If this returns successfully, that means it failed.
		// Stop right before the last one
		var failed = _.find(_.initial(keys), function(item) {
			if (_.has(current, item)) {
				current = current[item];
				return false;
			} else return true;
		});
		
		if (failed) return undefined;
		else return current[_.last(keys)];
	}

});

module.exports = Config;