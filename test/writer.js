var assert = require("assert"),
    test = require("./testlib")(),
    hiredis = require("../hiredis");

test("WriteCommand", function() {
    var reader = new hiredis.Reader();
    reader.feed(hiredis.writeCommand("hello", "world"));
    assert.deepStrictEqual(["hello", "world"], reader.get());
});

test("WriteUnicode", function() {
    var reader = new hiredis.Reader();
    reader.feed(hiredis.writeCommand("béép"));
    assert.deepStrictEqual(["béép"], reader.get());
});

test("WriteBuffer", function() {
    var reader = new hiredis.Reader({ return_buffers: true });
    reader.feed(hiredis.writeCommand(new Buffer.from([0xC3, 0x28])));
    var command = reader.get();
    assert.strictEqual(0xC3, command[0][0]);
    assert.strictEqual(0x28, command[0][1]);
});

test("WriteNumber", function() {
    var reader = new hiredis.Reader();
    reader.feed(hiredis.writeCommand(3));
    assert.deepStrictEqual(["3"], reader.get());
});
