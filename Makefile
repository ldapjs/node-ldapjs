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

RESTDOWN = ./node_modules/.restdown/bin/restdown
#RESTDOWN = restdown
RESTDOWN_VERSION=1.2.13
DOCPKGDIR = ./docs/pkg

.PHONY:  dep lint test doc clean all

all:: test doc

node_modules/.ldapjs.npm.installed:
	$(NPM) install --dev
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
	${RESTDOWN} -m ${DOCPKGDIR} -D mediaroot=media ./docs/client.md
	${RESTDOWN} -m ${DOCPKGDIR} -D mediaroot=media ./docs/examples.md
	${RESTDOWN} -m ${DOCPKGDIR} -D mediaroot=media ./docs/guide.md
	rm docs/*.json
	mv docs/*.html ${DOCPKGDIR}
	(cd ${DOCPKGDIR} && $(TAR) -czf ${SRC}/${NAME}-docs-`git log -1 --pretty='format:%h'`.tar.gz *)


test: dep lint
	$(NPM) test

clean:
	@rm -fr ${DOCPKGDIR} node_modules *.log *.tar.gz
