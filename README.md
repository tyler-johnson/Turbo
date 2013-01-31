# Turbo

This is Turbo. She ain't pretty (yet), but she'll run. This is still super alpha, so don't expect any fireworks. Here's what you'll need to get her running: Mongo, Redis, and Node. This page will be updated as frequently as I can get to it. Feel free to play around and tell me what you think.

If you want to see an example of Turbo in action, check out [turbo-example](https://github.com/appleifreak/turbo-example).

## FAQ

### What is a Content Management Platform?

Well, I'm not sure, I just made it up, sort of (Drupal uses that terminology too). Essentially, this is a "faceless" foundation for running dynamic websites. What do I mean by dynamic? Blogs, e-commerce, information sites, anything that has changing data.

At it's core, Turbo is really just a Theme, which converts files into something that can be sent to the browser, and a Router, which takes incoming requests, retrieves associated data, and passes it along. Using plugins, you can access these major components and combine them to control how the data will be displayed (in theory). The neat part is that these two elements are completely seperate; each can be run without the other. This causes the need for some weird fajangles (see [connect.js](https://github.com/appleifreak/Turbo/blob/master/connect.js)), but overall it allows for a smooth (modular?) ride.

### Should I use this?

Sure, just only for testing; no "live" environments. As I said above, it's in ALPHA. You can expect this API to change dramatically between now and the first stable build.

### How do I get this to run?

Well it's a setup to be a node module, but it hasn't been added to the NPM registry yet. Add `"turbo": "git://github.com/appleifreak/Turbo.git"` to your `package.json` or run `npm install git://github.com/appleifreak/Turbo.git` in the app folder.

In your main javascript file, you can now run `var Turbo = require('turbo')` to create a fresh a Turbo instance and return it. Turbo will not be running at this point. You will have to let it know where major system paths are (theme, plugins, config.json) and then run `Turbo.liftoff()`. For an example of *exactly* how Turbo should be set up, see [turbo-example](https://github.com/appleifreak/turbo-example).

At this point, anything you try to type into you browser will probably return a 404 because you don't have any content set up. Create a collection in your mongo database named `routes` and add a document with following format:

	{
		type: "page",
		handle: "/my-page",
		data: {
			title: "My New Page",
			content: "<p>This is some page content.</p>"
		}
	}
	
`type` and `handle` should both be strings. They are both used by the Router to determine where to send a request. The `data` object can actually be anything. It is attached to the route so something else down the line can use it.

Try `localhost:3000/my-page` in your browser to view the route. Turbo should now be running like a website.

### Where is the documentation?!

Coming soon. I'm the only one working on this right now and I have only had time to write some of it out. Some of the code has documentation and everything else is *decently* commented, so you should be able to get the gist of what's going on. I am definitely here to help so don't hesitate to [contact me](mailto:tyler@vintyge.com).

### What is the plan for development?

I have several clients "dieing" to use this thing, so immediately an admin (aka the actual CMS portion) plugin should become available. This will give the "faceless" foundation a face my customers can use to make changes to their site. This will actually become something of beast as it too will have an API for other plugins to use.

Besides that, I will continue to work on this for the foreseeable future. This is guaranteed to have a bug or two or probably a ton, plus there's plenty of functionality still missing. As more resources become available, more work can be completed. Basically, I do what I can and will take any help I can get.

### Who is maintaining this?

This repo is maintained by me (…obviously), Tyler Johnson ([@appleifreak](http://github.com/appleifreak), <tyler@vintyge.com>). I am the lead developer and co-owner of [Vintyge, Inc.](http://vintyge.com), a small creative web firm. This is our first foray into the world of open source. If you have any questions, concerns, thoughts, dilemmas or really anything, please contact me: <tyler@vintyge.com>.