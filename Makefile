NAME=ldapjs

ifeq ($(VERSION), "")
	@echo "Use gmake"
endif


SRC := $(shell pwd)
TAR = tar
UNAME := $(shell uname)
ifeq ($(UNAME), SunOS)
	TAR = gtar
endif

HAVE_GJSLINT := $(shell which gjslint >/dev/null && echo yes || echo no)
NPM := npm_config_tar=$(TAR) npm

RESTDOWN_VERSION=1.2.13
DOCPKGDIR = ./docs/pkg

RESTDOWN = ./node_modules/.restdown/bin/restdown \
	-b ./docs/branding \
	-m ${DOCPKGDIR} \
	-D mediaroot=media

.PHONY:  dep lint test doc clean all

all:: test doc

node_modules/.ldapjs.npm.installed:
	$(NPM) install
	if [[ ! -d node_modules/.restdown ]]; then \
		git clone git://github.com/trentm/restdown.git node_modules/.restdown; \
	else \
		(cd node_modules/.restdown && git fetch origin); \
	fi
	@(cd ./node_modules/.restdown && git checkout $(RESTDOWN_VERSION))
	@touch ./node_modules/.ldapjs.npm.installed

dep:	./node_modules/.ldapjs.npm.installed

gjslint:
	gjslint --nojsdoc -r lib -r tst

ifeq ($(HAVE_GJSLINT), yes)
lint: gjslint
else
lint:
	@echo "* * *"
	@echo "* Warning: Cannot lint with gjslint. Install it from:"
	@echo "*    http://code.google.com/closure/utilities/docs/linter_howto.html"
	@echo "* * *"
endif

doc: dep
	@rm -rf ${DOCPKGDIR}
	@mkdir -p ${DOCPKGDIR}
	${RESTDOWN} ./docs/client.md
	${RESTDOWN} ./docs/dn.md
	${RESTDOWN} ./docs/errors.md
	${RESTDOWN} ./docs/examples.md
	${RESTDOWN} ./docs/filters.md
	${RESTDOWN} ./docs/guide.md
	${RESTDOWN} ./docs/index.md
	${RESTDOWN} ./docs/server.md
	rm docs/*.json
	mv docs/*.html ${DOCPKGDIR}
	(cd ${DOCPKGDIR} && $(TAR) -czf ${SRC}/${NAME}-docs-`git log -1 --pretty='format:%h'`.tar.gz *)


test: dep lint
	$(NPM) test

clean:
	@rm -fr ${DOCPKGDIR} node_modules *.log *.tar.gz
