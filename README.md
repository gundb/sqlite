# sqlite
SQLite3 persistence layer for [gun](https://github.com/amark/gun)!

Or in other words: If you use gun as your API to SQLite3, you'll get free data sync and replication across different machines running SQLite3! Check out the gun docs for how to set that up.

Get it by

`npm install sqlite.gun`

Use by

```javascript
var Gun = require('gun');
require('sqlite.gun');

var gun = Gun({
  file: false // turn off pesky file.js data.json default 
});
```

Check the gun docs on how to read/write data, and sync will happen automatically.

Enjoy!

Or: Complain about bugs. :)
