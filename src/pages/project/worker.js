// noinspection InfiniteLoopJS

onmessage = async ev => {
    let sprites = ev.data;
    const spriteCalls = [];
    let spriteId = 0;
    let lastUpdate = Date.now();
    let nextSprites = null;

    onmessage = ev => nextSprites = ev.data;

    function update() {
        postMessage(sprites);
    }

    for (let i = 0; i < sprites.length; i++) {
        const sprite = sprites[i];
        const code = sprite.code;
        delete sprite.code;
        sprite.id = ++spriteId;
        sprite.update = () => update();
        self.__spriteTmp__ = sprite;
        spriteCalls.push(await import(URL.createObjectURL(new Blob([
            "const sprite = __spriteTmp__;" +
            "const updateSprite = sprite.update;" +
            "delete sprite.update;" +
            "delete self.__spriteTmp__;" +
            code
        ], {type: "application/javascript"}))));
    }

    setInterval(() => {
        self.time = Date.now();
        const dt = (time - lastUpdate) / 1000;
        lastUpdate = time;
        for (let i = 0; i < spriteCalls.length; i++) {
            const call = spriteCalls[i];
            if (call.update) call.update(dt);
        }
        if (nextSprites) {
            sprites = nextSprites;
        } else update();
    });
};