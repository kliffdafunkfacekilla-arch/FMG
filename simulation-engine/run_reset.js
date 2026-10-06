const { resetWorld } = require('./dist/engine/resetWorld');

async function test() {
    await resetWorld();
    console.log("Done");
    process.exit(0);
}
test().catch(console.error);
