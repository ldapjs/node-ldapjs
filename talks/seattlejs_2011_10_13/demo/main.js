var fs = require('fs');

var ldap = require('ldapjs');
var log4js = require('log4js');
var GitHubApi = require("github").GitHubApi;



///--- Globals

var USER;
var TOKEN;
try {
  USER = process.argv[2];
  TOKEN = fs.readFileSync(process.env.HOME + '/.github', 'utf8');
} catch (e) {}

var OU_USERS = 'o=github';



///--- Mainline
log4js.setGlobalLogLevel('DEBUG');
var log = log4js.getLogger('main');
log.setLevel('INFO');

var github = new GitHubApi(true);
if (USER && TOKEN)
  github.authenticateToken(USER, TOKEN);

var server = ldap.createServer({
  log4js: log4js
});

server.search('o=github', function(req, res, next) {
  // Only handle basic filters (eq/ge/le)
  if (!req.filter.attribute)
    return next(new ldap.OperationsError(req.filter.toString() +
                                         ' not supported'));


  var user = USER;
  req.dn.rdns.forEach(function(rdn) {
    if (rdn.user)
      user = rdn.user;
  });

  switch (req.filter.attribute) {
  case 'user':
    if (req.filter.value)
      user = req.filter.value;

    github.getUserApi().show(user, function(err, _user) {
      if (err && err.status !== 404)
        return next(new ldap.OperationsError(err.msg.error[0]));

      if (!_user) {
        res.end();
        return next();
      }

      github.getUserApi().getFollowers(user, function(err, followers) {
        if (err)
          return next(new ldap.OperationsError(err.msg.error[0]));

        github.getUserApi().getFollowing(user, function(err, following) {
          if (err)
            return next(new ldap.OperationsError(err.msg.error[0]));

          var obj = {
            dn: 'user=' + _user.login + ', ' + OU_USERS,
            attributes: {
              user: _user.login,
              name: _user.name || null,
              company: _user.company || null,
              mail: _user.email || null,
              l: _user.location || null,
              plan: _user.plan ? _user.plan.name : null,
              follower: followers || null,
              follows: following || null,
              objectclass: 'user'
            }
          };

          Object.keys(obj.attributes).forEach(function(k) {
            if (obj.attributes[k] === null)
              delete obj.attributes[k];
          });

          if (req.filter.matches(obj.attributes) &&
              (req.dn.parentOf(obj.dn) || req.dn.equals(obj.dn)))
            res.send(obj);

          res.end();
        });
      });
    });
    break;

  case 'repository':
    github.getRepoApi().getUserRepos(user, function(err, repos) {
      if (err)
        return next(new ldap.OperationsError(err.msg.error[0]));

      var done = 0;
      repos.forEach(function(r) {
        github.getRepoApi().getRepoWatchers(user, r.name, function(err, w) {
          if (err)
            return next(new ldap.OperationsError(err.msg.error[0]));

          var obj = {
            dn: 'repository=' + r.name + ', user=' + user + ', ' + OU_USERS,
            attributes: {
              repository: r.name,
              description: r.description,
              url: r.url,
              forks: r.forks,
              homepage: r.homepage,
              language: r.language,
              issues: r.open_issues,
              watcher: w,
              objectclass: 'repository'
            }
          };

          if (req.filter.matches(obj.attributes) &&
              (req.dn.parentOf(obj.dn) || req.dn.equals(obj.dn)))
            res.send(obj);

          if (++done === repos.length)
            res.end();
        });
      });
    });

    break;

  case 'issue':
    github.getRepoApi().getUserRepos(user, function(err, repos) {
      if (err)
        return next(new ldap.OperationsError(err.msg.error[0]));

      var done = 0;
      repos.forEach(function(r) {
        github.getIssueApi().getList(user, r.name, 'open', function(err, is) {
          if (err)
            return next(new ldap.OperationsError(err.msg.error[0]));

          is.forEach(function(i) {
            var dn = 'issue=' + i.number +
              ', repository=' + r.name +
              ', user=' + user +
              ', ' + OU_USERS;

            var obj = {
              dn: dn,
              attributes: {
                issue: i.number,
                user: i.user,
                votes: i.votes,
                url: i.html_url,
                comments: i.comments,
                body: i.body,
                objectclass: 'issue'
              }
            };

            if (req.filter.matches(obj.attributes) &&
                (req.dn.parentOf(obj.dn) || req.dn.equals(obj.dn)))
              res.send(obj);
          });

          if (++done === repos.length)
            res.end();
        });
      });
    });
    break;

  default:
    res.end();
  }
});

server.listen(1389, function() {
  log.info('LDAP server listening at %s for github user %s',
           server.url, USER || '');
});
