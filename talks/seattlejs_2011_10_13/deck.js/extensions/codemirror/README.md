Deck.js-CodeMirror Extension
============================

This extension allows you to embed codemirror code snippets in your slides. Those codeblocks
can also be executable, which is pretty exciting.

An example is running here: http://ireneros.com/deck/deck.js-codemirror/introduction

You can also see those slides in the `introduction` folder.

# Installation: #

Move all this into a folder called 'codemirror' in your deck.js/extensions/ folder.

# Setup: #

Include the stylesheet:

    <link rel="stylesheet" href="../extensions/codemirror/deck.codemirror.css">

Include the JS source:

    <!-- Base codemiror code -->
    <script src="../extensions/codemirror/codemirror.js"></script>

    <!-- Syntax highlighting Modes -->
    
    <!-- javascript -->
    <script src="../mode/javascript/javascript.js"></script>

    <!-- html mode (note html mode requires xml, css and javascript) -->
    <script src="../extensions/codemirror/mode/xml/xml.js"></script>
    <script src="../extensions/codemirror/mode/css/css.js"></script>
    <script src="../extensions/codemirror/mode/htmlmixed/htmlmixed.js"></script>

    <!-- Plugin code -->
    <script src="../extensions/codemirror/deck.codemirror.js"></script>

Include your favorite CodeMirror syntax style:

    <link rel="stylesheet" href="../extensions/codemirror/themes/default.css">

  Options are:
    
    cobalt.css
    default.css
    elegant.css
    neat.css
    night.css


# Use: #

There are two ways to create code blocks:
Inside your slide:

## Text Area:

    <div>
      <textarea id="code" name="code" class="code" mode="javascript" style="display: none;" runnable="true">// codemirror demo party!
        var greeter = function(name) {
          return "Why hello there " + name;
        }
        console.log(greeter("Joe"));
      </textarea>
    </div>
  
## Any other item:

    <div>
      <div id="code" name="code" class="code" mode="javascript" style="display: none;">// codemirror demo party!
        var obj = { text : "Hello all!"};
        console.log("HI THERE");
      </div>
    </div>

# Setup scripts: #

Sometimes you have to do a lot of set up for your code that doesn't need to live inside
the actual codemirror editor (because it's not of interest to your readers.) You can now 
create hidden script tags that will be evaluated on "Run" before the editor code runs.

It must have the type set to "codemirror" and the data-selector must be set to the selector of
the editor that it's running for:

    <script type="codemirror" data-selector="#code4">
      var someVar = 10;
    </script>

    <textarea id="code4" name="code" class="code" mode="javascript" style="display: none;" runnable="true">
      // output my log
      console.log(someVar);
    </textarea>

# Globals! #

Sometimes you just need to access a global of some kind. The code in the codemirror editors is executed
in a sandbox, which means whatever it is you load in your actual slides, is NOT going to be available by default.
To give access to, for example, jQuery object, define a "globals" attribute on the code blocks with 
the names of the vars you need. Globals can be comma delimited, for example: "$,Backbone,_".

    <textarea id="code4" name="code" class="code" mode="javascript" style="display: none;" runnable="true" globals="$">
      // output my log
      console.log($('script').size());
    </textarea>

# Element Attributes: #

Regardless of your element type, the following attributes should be set:

* class - code (should always be set to code.)
* mode  - language mode. This plugin now supports all modes. Look into the mode directory and include the ones you like. Note that some require additional modes so be sure to check the Codemirror site.
* theme (optional) - If you want multiple themes in your slides, include multiple stylesheets and set this attribute to the theme name.
* runnable (optiona) - If true, will add a Run button to the window and pipe the eval's console output to an output element right below. 

# Contact: #
Irene Ros (@ireneros)
http://bocoup.com

    
