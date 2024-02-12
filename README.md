# TypeScript Asteroids

TypeScript Asteroids, based Doug McInnes's original [JavaScript-based HTML5 Asteroids](http://dougmcinnes.com/2010/05/12/html-5-asteroids/) (original [source](https://github.com/dmcinnes/HTML5-Asteroids)).

# To build

```bash
$ npm install
$ npx vite dev
# ... then browse to the printed localhost url
```

# To release

```bash
$ git pull
$ git tag -l  # observe the next available tag
$ tag=next_tag_here
$ git tag ${tag}
$ git push origin ${tag}
```
