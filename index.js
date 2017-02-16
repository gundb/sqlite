var sqlite3 = require('sqlite3');
var mq = require('masterquest-sqlite3');
var Gun = require('gun/gun');
var client;
var store;

var sqls = {};
var block = {};
var mqthen = [];

Gun.on('opt', function(at){
	this.to.next(at);
	if(at.once){ return }
	var file = ((at.opt||{}).sqlite||{}).file || (__dirname + '/data.sqlite3');
	client = sqls[file] || (sqls[file] = new sqlite3.Database(file));
	
	var schemae = [{
	  modelname: 'Record'
	, indices: ['soul', 'field', 'value', 'relation', 'state'] // TODO: Test perf against only soul/field index?
	}];

	mq.wrap(client, schemae).then(function(storage){
		store = storage; // race condition!
		mqthen.forEach(function(at){
			Gun.on(at.get? 'get' : 'put', at);
		});
		mqthen = [];
	});
});

Gun.on('put', function(at){
	this.to.next(at);
	if(!store){ return mqthen.push(at) }
	var gun = at.gun.back(-1), put = at.put, check = {};
	Gun.graph.is(put, null, function(value, field, node, soul){ var id;
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
	if(!store){ return mqthen.push(at) }
	var u;
	var gun = at.gun;
	var get = at.get;
	if(!get){ return }
	var soul = get['#'];
	var field = get['.'];
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