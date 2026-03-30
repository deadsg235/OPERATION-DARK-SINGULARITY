.PHONY: build test clean
build:
	npm install && npm run build
test:
	npm test
clean:
	rm -rf node_modules dist
