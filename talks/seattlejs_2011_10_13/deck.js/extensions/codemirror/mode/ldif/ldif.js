CodeMirror.defineMode("ldif", function() {
  return {
    token: function(stream) {
      var ch = stream.next();
      stream.skipToEnd();
      if (ch == "#")
        return "comment";
    }
  };
});

CodeMirror.defineMIME("text/x-ldif", "ldif");
