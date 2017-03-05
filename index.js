var sqlite3 = require('sqlite3');
var mq = require('masterquest-sqlite3');
var Gun = require('gun/gun');
require('./multi');
var strict = require('./strict');

var sqls = {};
var block = {};
var mqthen = [];

Gun.on('opt', function(at){
	this.to.next(at);
	if(at.once){ return }
	var opt = at.opt.sqlite || (at.opt.sqlite = {});
	opt.file = opt.file || (__dirname + '/data.sqlite3');
	opt.client = sqls[opt.file] || (sqls[opt.file] = new sqlite3.Database(opt.file));
	opt.client.run("PRAGMA synchronous = 0"); // necessary for perf!
	var tables = [{
	  modelname: 'Record'
	, indices: ['soul', 'field', 'value', 'relation', 'state'] // TODO: Test perf against only soul/field index?
	}];
	if(opt.tables){ tables.concat(opt.tables) }

	mq.wrap(opt.client, tables).then(function(storage){
		opt.store = storage;
		mqthen.forEach(function(at){
			Gun.on(at.get? 'get' : 'put', at);
		});
		mqthen = [];
	});
});

Gun.on('put', function(at){
	this.to.next(at);
	var gun = at.gun.back(-1), opt = gun.back('opt.sqlite'), store = opt.store;
	if(!store){ return mqthen.push(at) }
	if(opt.tables){ return strict.put(at, gun, opt, store) } // strict mode
	var check = {};
	Gun.graph.is(at.put, null, function(value, field, node, soul){ var id;
		block[soul] = node;
		store.Record.get(id = soul+field).then(function(record){
			var data = {id: id, soul: soul, field: field, state: Gun.state.is(node, field)}, tmp;
			// Check to see if what we have on disk is more recent.
			if(record && data.state < parseFloat(record.state)){ return }
			if(value && (tmp = value['#'])){ // TODO: Don't hardcode.
				data.relation = tmp;
			} else {
				data.value = JSON.stringify(value);
			}
			check[id] = true;
			block[id] = data;
			store.Record.upsert(id, data).then(function(){
				Gun.obj.del(block, id);
				Gun.obj.del(block, soul);
				check[id] = false;
				if(Gun.obj.map(check, function(val){
					if(val){ return true }
				})){ return }
				gun.on('in', {'@': at['#'], ok: 1});
			}, function(e){
				if(e && e.toString().indexOf('UNIQUE') >= 0){
					// race condition in masterquest?
					return;
				}
				gun.on('in', {'@': at['#'], err: e});
			});
		});
	});
});

Gun.on('get', function(at){
	this.to.next(at);
	var gun = at.gun.back(-1), opt = gun.back('opt.sqlite'), store = (opt||{}).store;
	if(!store){ return mqthen.push(at) }
	var lex = at.get, u;
	if(!lex){ return }
	var soul = lex['#'];
	var field = lex['.'];
	if(opt.tables){ return strict.get(at, gun, opt, store, soul, field) } // strict mode
	if('_' === field){
		return store.Record.find({soul: soul}, {limit:1}).then(function(record){
			record = (record||[])[0] || block[soul];
			if(!record){
				return gun.on('in', {'@': at['#']});
			}
			var empty = Gun.state.ify(u, u, u, u, soul);
			gun.on('in', {'@': at['#'], put: Gun.graph.node(empty)});
		})
	}
	if(field){
		return store.Record.get(soul+field).then(function(record){
			record = record || block[soul+field];
			gun.on('in', {'@': at['#'], put: Gun.graph.node(nodeify(record))});
		});
	}
	store.Record.find({soul: soul}).then(function(records){
		var node;
		if(!records || !records.length){
			if(!block[soul]){
				return gun.on('in', {'@': at['#']});
			}
			node = block[soul];
		}
		if(!node){
			records.forEach(function(record){
				node = nodeify(record, node);
				// TODO: Convert to streaming - including getting MasterQuest to stream records.
			});
		}
		gun.on('in', {'@': at['#'], put: Gun.graph.node(node)});
	});
});

function nodeify(record, node){
	if(!record){ return }
	var value;
	try{value = record.relation? Gun.val.rel.ify(record.relation) : JSON.parse(record.value);
	}catch(e){}
	return Gun.state.ify(node, record.field, parseFloat(record.state), value, record.soul);
}