var assert = require("assert"),
    test = require("./testlib")(),
    hiredis = require("../hiredis");

test("CreateReader", function() {
    var reader = new hiredis.Reader();
    assert.notStrictEqual(reader, null);
});

test("StatusReply", function() {
    var reader = new hiredis.Reader();
    reader.feed("+OK\r\n");
    assert.strictEqual("OK", reader.get());
});

test("StatusReplyAsBuffer", function() {
    var reader = new hiredis.Reader({ return_buffers: true });
    reader.feed("+OK\r\n");
    var reply = reader.get();
    assert.ok(Buffer.isBuffer(reply));
    assert.strictEqual("OK", reply.toString());
});

test("IntegerReply", function() {
    var reader = new hiredis.Reader();
    reader.feed(":1\r\n");
    assert.strictEqual(1, reader.get());
});

test("LargeIntegerReply", function() {
    var reader = new hiredis.Reader();
    reader.feed(":9223372036854775807\r\n");
    // We test for a different value here, as JavaScript has no 64-bit integers,
    // only IEEE double precision floating point numbers
    assert.strictEqual("9223372036854776000", String(reader.get()));
});

test("ErrorReply", function() {
    var reader = new hiredis.Reader();
    reader.feed("-ERR foo\r\n");
    var reply = reader.get();
    assert.strictEqual(Error, reply.constructor);
    assert.strictEqual("ERR foo", reply.message);
});

test("ErrorReplyWithReturnBuffers", function() {
    var reader = new hiredis.Reader({ return_buffers: true });
    reader.feed("-ERR foo\r\n");
    var reply = reader.get();
    assert.strictEqual(Error, reply.constructor);
    assert.strictEqual("ERR foo", reply.message);
});

test("NullBulkReply", function() {
    var reader = new hiredis.Reader();
    reader.feed("$-1\r\n");
    assert.strictEqual(null, reader.get());
});

test("EmptyBulkReply", function() {
    var reader = new hiredis.Reader();
    reader.feed("$0\r\n\r\n");
    assert.strictEqual("", reader.get());
});

test("BulkReply", function() {
    var reader = new hiredis.Reader();
    reader.feed("$3\r\nfoo\r\n");
    assert.strictEqual("foo", reader.get());
});

test("BulkReplyAsBuffer", function() {
    var reader = new hiredis.Reader({ return_buffers: true });
    reader.feed("$3\r\nfoo\r\n");
    var reply = reader.get();
    assert.ok(Buffer.isBuffer(reply));
    assert.strictEqual("foo", reply.toString());
});

test("BulkReplyWithEncoding", function() {
    var reader = new hiredis.Reader();
    reader.feed("$" + Buffer.byteLength("☃") + "\r\n☃\r\n");
    assert.strictEqual("☃", reader.get());
});

test("NullMultiBulkReply", function() {
    var reader = new hiredis.Reader();
    reader.feed("*-1\r\n");
    assert.strictEqual(null, reader.get());
});

test("EmptyMultiBulkReply", function() {
    var reader = new hiredis.Reader();
    reader.feed("*0\r\n");
    assert.deepStrictEqual([], reader.get());
});

test("MultiBulkReply", function() {
    var reader = new hiredis.Reader();
    reader.feed("*2\r\n$3\r\nfoo\r\n$3\r\nbar\r\n");
    assert.deepStrictEqual(["foo", "bar"], reader.get());
});

test("NestedMultiBulkReply", function() {
    var reader = new hiredis.Reader();
    reader.feed("*2\r\n*2\r\n$3\r\nfoo\r\n$3\r\nbar\r\n$3\r\nqux\r\n");
    assert.deepStrictEqual([["foo", "bar"], "qux"], reader.get());
});

test("DeeplyNestedMultiBulkReply", function() {
    var i;
    var reader = new hiredis.Reader();
    var expected = 1;

    for (i = 0; i < 8; i++) {
      reader.feed("*1\r\n");
      expected = [expected];
    }

    reader.feed(":1\r\n");

    assert.deepStrictEqual(reader.get(), expected);
});

test("TooDeeplyNestedMultiBulkReply", function() {
    var i;
    var reader = new hiredis.Reader();

    for (i = 0; i < 9; i++) {
      reader.feed("*1\r\n");
    }

    reader.feed(":1\r\n");

    assert.throws(
      function() {
        reader.get();
      },
      /nested multi/
    );
});

test("MultiBulkReplyWithNonStringValues", function() {
    var reader = new hiredis.Reader();
    reader.feed("*3\r\n:1\r\n+OK\r\n$-1\r\n");
    assert.deepStrictEqual([1, "OK", null], reader.get());
});

test("FeedWithBuffer", function() {
    var reader = new hiredis.Reader();
    reader.feed(new Buffer.from("$3\r\nfoo\r\n"));
    assert.deepStrictEqual("foo", reader.get());
});

test("UndefinedReplyOnIncompleteFeed", function() {
    var reader = new hiredis.Reader();
    reader.feed("$3\r\nfoo");
    assert.deepStrictEqual(undefined, reader.get());
    reader.feed("\r\n");
    assert.deepStrictEqual("foo", reader.get());
});

test("Leaks", function() {
    /* The "leaks" utility is only available on OSX. */
    if (process.platform != "darwin") return;

    var done = 0;
    var leaks = require('child_process').spawn("leaks", [process.pid]);
    leaks.stdout.on("data", function(data) {
        var str = data.toString();
        var notice = "Node 0.2.5 always leaks 16 bytes (this is " + process.versions.node + ")";
        var matches;
        if ((matches = /(\d+) leaks?/i.exec(str)) != null) {
            if (parseInt(matches[1]) > 0) {
                console.log(str);
                console.log('\x1B[31mNotice: ' + notice + '\x1B[0m');
            }
        }
        done = 1;
    });

    process.on('exit', function() {
        assert.ok(done, "Leaks test should have completed");
    });
});
