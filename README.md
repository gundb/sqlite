# sqlite
SQLite3 persistence layer for [gun](https://github.com/amark/gun)! GUN is an Open Source Firebase with swappable storage engines (level, SQLite, etc.) that handles data synchronization across machines / devices.

Or in other words: If you use gun as your API to SQLite3, you'll get multi-machine SQLite3 clusters for free!

Get it by

`npm install sqlite.gun`

Use by

```javascript
var Gun = require('gun');
require('sqlite.gun');

var gun = Gun({
  file: false // turn off pesky file.js data.json default
  , sqlite: {
    file: "gun.sqlite3"
  }
});
```

Check the gun docs on how to read/write data, it will then handle sync automatically for you (even to the browser!). Tip: It is a graph database, so you can do key/value, document, relational, or graph based data - here is a [crash course](https://github.com/amark/gun/wiki/graphs) on how to use it.

Enjoy!

Or: Complain about bugs. :)
