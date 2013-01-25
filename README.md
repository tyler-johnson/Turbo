# Turbo

This is Turbo. She ain't pretty (yet), but she'll run. This is still super alpha, so don't expect any fireworks. Here's what you'll need to get her running: Mongo, Redis, and Node. This page will be updated as frequently as I can get to it. Feel free to play around and tell me what you think.



## FAQ

### What is a Content Management Platform?

Well, I'm not sure, I just made it up, sort of (Drupal uses that terminology too). Essentially, this is a "faceless" foundation for running dynamic websites. What do I mean by dynamic? Blogs, e-commerce, information sites, anything that has changing data.

At it's core, Turbo is really just a Theme, which converts files into something that can be sent the browser, and a Router, which takes incoming requests, retrieves associated data, and passes it along. Using plugins, you can access these major components and control how the data is displayed (in theory).

### Should I use this?

Sure, just only for testing; no "live" environments. As I said above, it's in ALPHA. You can expect this API to change dramatically between now and the first stable build.

### Where is the documentation?!

Coming soon. I'm the only one working on this right now and I have not had time to write it out. The code is *decently* commented, so you should be able to get the gist of what's going on. I am definitely here to help via email so don't hesitate.

### What is the plan for developing this thing?

I have several clients "dieing" to use this thing, so immediately an admin (aka the actual CMS portion) plugin should become available. This will give the "faceless" foundation a face my customers can use to make changes to their site. This will actually become something of beast as it too will have an API for other plugins to use.

Besides that, I will continue to work on this for the foreseeable future. This is guaranteed to have a bug or two or probably a ton, plus there's plenty of functionality still missing. As more resources become available, more work can be completed. Basically, I do what I can and will take any help I can get.

### Who is maintaining this?

This repo is maintained by me (…obviously), Tyler Johnson ([@appleifreak](http://github.com/appleifreak), <tyler@vintyge.com>). I am the lead developer and co-owner of [Vintyge, Inc.](http://vintyge.com), a small creative web firm. This is our first foray into the world of open source libraries. If you have any questions, concerns, thoughts, dilemmas or really anything, please contact me: <tyler@vintyge.com>.

## MIT License

Copyright (c) 2013 [Vintyge, Inc.](http://vintyge.com) All Right Reserved. 

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.