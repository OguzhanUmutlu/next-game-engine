// noinspection InfiniteLoopJS

onmessage = async ev => {
    let sprites = ev.data;
    const spriteCalls = [];
    let spriteId = 0;
    let lastUpdate = Date.now();
    let nextSprites = null;

    const EventHandler = {
        mouse: data => Object.assign(mouse, data),
        keyboard: data => Object.assign(keyboard, data),
        screen: data => Object.assign(screen, data),
        mouseAction: data => mouseActions.push(data),
        keyboardAction: data => keyboardActions.push(data),
        fps: data => screen.fps = data
    };
    onmessage = ev => {
        if (ev.data.event) {
            EventHandler[ev.data.event](ev.data.data);
            return;
        }
        nextSprites = ev.data;
    };

    function frozenBuilder(struct) {
        const frozen = {};
        for (const k in struct) Object.defineProperty(frozen, k, {
            get: () => struct[k]
        });
        return [struct, frozen];
    }

    let [mouse, frozenMouse] = frozenBuilder({x: 0, y: 0, down: {}});
    let keyboard = {};
    const frozenKeyboard = new Proxy({}, {get: (target, p) => keyboard[p]});
    let [screen, frozenScreen] = frozenBuilder({width: 0, height: 0, isMaximized: false, fps: 0});
    const mouseActions = [];
    const keyboardActions = [];

    function update() {
        postMessage(sprites);
    }

    const stop = self.stop = error => {
        postMessage({
            sprites,
            terminate: true,
            error: error ? error.toString() : undefined
        });
    };

    const sendError = error => {
        error = error || "";
        postMessage({error: error instanceof Error ? error.toString() : "Error: " + error.toString()});
    };

    const stringLookup = {
        string: n => n,
        number: n => n.toString(),
        object(n) {
            if (n instanceof Array) return `[${n.map(i => toString(i)).join(", ")}]`;
            return `{${Object.keys(n).map(i => `${JSON.stringify(i)}: ${toString(n[i])}`)}}`;
        },
        bigint: n => n.toString() + "n",
        undefined: () => "undefined",
        boolean: n => n ? "true" : "false",
        symbol: n => n.toString(),
        function: n => n.toString()
    };

    function toString(m) {
        if (m === null) return "null";
        return stringLookup[typeof m](m);
    }

    function debug(...m) {
        postMessage({debug: m.map(i => toString(i).split("\n")).flat()});
    }

    debug.clear = function () {
        postMessage({debugClear: true});
    };

    function exit(code = 0) {
        stop("(0x" + (typeof code === "number" ? code : 1).toString(16).padStart(4, "0") + ") Terminated by script.");
    }

    for (let i = 0; i < sprites.length; i++) {
        const sprite = sprites[i];
        const {code, extension} = sprite;
        delete sprite.code;
        delete sprite.extension;
        sprite.id = ++spriteId;
        if (extension === ".py") continue;
        const Next = {
            update,
            sprites,
            mouse: frozenMouse,
            keyboard: frozenKeyboard,
            screen: frozenScreen,
            debug
        };
        self.__spriteTmp__ = [sprite, Next, exit];
        let err;
        const mdl = await import(URL.createObjectURL(new Blob([
            "const [sprite, Next, exit] = self.__spriteTmp__;" +
            "delete self.__spriteTmp__;" +
            code
        ], {type: "application/javascript"}))).then(r => r).catch(r => err = r);
        if (err) {
            sendError(err);
            throw err;
        }
        if (mdl.update) spriteCalls.push(mdl.update);
    }

    if (!spriteCalls.length) {
        stop();
        return;
    }

    setInterval(() => {
        self.time = Date.now();
        const dt = (time - lastUpdate) / 1000;
        lastUpdate = time;
        for (let i = 0; i < spriteCalls.length; i++) {
            try {
                spriteCalls[i](dt);
            } catch (e) {
                sendError(e);
                throw e;
            }
        }
        if (nextSprites) {
            for (let i = 0; i < sprites.length; i++) {
                let fn = false;
                for (let j = 0; j < nextSprites.length; j++) {
                    const original = sprites[i];
                    const next = nextSprites[j];
                    if (original.name === next.name) {
                        Object.assign(original, next);
                        fn = true;
                        break;
                    }
                }
                if (!fn) {
                    sendError("A sprite was removed");
                    throw "A sprite was removed.";
                }
            }
            nextSprites = null;
        } else update();
    });
};