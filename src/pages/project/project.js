const query = new URLSearchParams(location.search);
const path = query.get("path");
if (await __bridge__.isProjectMissing(path)) location.href = redirectTo("index", "");
await __bridge__.updateProjectEditedTimestamp(path);

const spritesDiv = document.querySelector(".sprite-container");
const codeDiv = document.querySelector(".code");
const saveText = document.querySelector(".save-text");
const sceneDiv = document.querySelector(".scene");
const propXDiv = document.getElementById("prop-x");
const propYDiv = document.getElementById("prop-y");
const propOpacityDiv = document.getElementById("prop-opacity");
const stopBtn = document.getElementById("stop-btn");
const terminalDiv = document.querySelector(".terminal");
const canvas = document.querySelector(".scene > canvas");
/*** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext("2d");

let selectedSprite = null;
let loadedEditor;
let saveTimeout;
let saveClearTimeout;
let currentWorker;
let spriteObjects = [];
let spriteImages = {};
let cachedSprites = [];
let lastPropCode = "";
let lastPropXDivVal = "";
let lastPropYDivVal = "";
let lastPropOpacityDivVal = "";

async function updateSelectSprite(name) {
    if (!loadedEditor || !cachedSprites || !spriteObjects) return;
    if (!name || !cachedSprites.some(i => i.name === name)) {
        name = (cachedSprites[0] ?? {name: null}).name;
    }
    loadedEditor.updateOptions({readOnly: !name});
    propXDiv.readOnly = !name;
    propYDiv.readOnly = !name;
    propOpacityDiv.style.pointerEvents = name ? "all" : "none";
    const sprite = spriteObjects.find(i => i.name === name);
    const code = await __bridge__.fetchSpriteCode(path, name);
    if (!sprite || code === null) {
        selectedSprite = null;
        loadedEditor.setValue("");
        propXDiv.value = "";
        propYDiv.value = "";
        propOpacityDiv.value = "";
        if (name) await refreshSprites();
        return;
    }
    if (selectedSprite !== name) {
        saveText.innerText = "";
        clearTimeout(saveTimeout);
        clearTimeout(saveClearTimeout);
    }
    if (sprite) {
        if (lastPropXDivVal !== sprite.x) propXDiv.value = sprite.x;
        if (lastPropYDivVal !== sprite.y) propYDiv.value = sprite.y;
        if (lastPropOpacityDivVal !== sprite.opacity) propOpacityDiv.value = sprite.opacity;
        lastPropXDivVal = sprite.x;
        lastPropYDivVal = sprite.y;
        lastPropOpacityDivVal = sprite.opacity;
    }
    if (lastPropCode !== code) loadedEditor.setValue(code);
    lastPropCode = code;
    selectedSprite = name;
}

async function refreshSprites() {
    cachedSprites = await __bridge__.fetchSprites(path);
    await __bridge__.createMissingSpriteImages(path);
    spritesDiv.innerHTML = "";
    for (const sprite of cachedSprites) {
        const div = document.createElement("div");
        div.classList.add("sprite");
        const name = document.createElement("div");
        name.classList.add("sprite-name");
        name.innerText = sprite.name;
        const img = document.createElement("img");
        img.src = path + "/sprites/images/" + sprite.name + ".png";
        div.appendChild(img);
        div.appendChild(name);
        const deleteBtn = document.createElement("div");
        deleteBtn.classList.add("sprite-delete");
        deleteBtn.innerHTML = "<img src='../../assets/delete.png'>";
        deleteBtn.addEventListener("click", async () => {
            setPopupText("Do you really want to delete the sprite called '" + sprite.name + "'", [
                ["Cancel", hidePopup],
                ["Yes", async () => {
                    await __bridge__.deleteSprite(path, sprite.name);
                    await refreshSprites();
                    hidePopup();
                }, "#25e025"]
            ]);
            showPopup();
        });
        div.appendChild(deleteBtn);
        div.addEventListener("click", e => {
            if (e.target !== div) return;
            updateSelectSprite(sprite.name);
        });
        spritesDiv.appendChild(div);
    }
    const div = document.createElement("div");
    div.classList.add("sprite");
    div.innerText = "+";
    div.addEventListener("click", async () => {
        setPopupText("<h1>Add sprite</h1>" +
            "<input id='sprite-name' style='font-size: 16px' placeholder='Sprite name...'><br>" +
            "<select id='sprite-extension'>" +
            "   <option value='.js'>Python</option>" +
            "   <option selected value='.js'>JavaScript</option>" +
            "</select>", [
            ["Cancel", () => {
                clearInterval(interval);
                hidePopup();
            }],
            ["Create", async () => {
                const name = document.getElementById("sprite-name").value;
                const extension = document.getElementById("sprite-extension").value;
                if (name.length <= 0 || name.length >= 64 || !VALID_NAME_REGEXP.test(name)) {
                    setPopupText("Invalid sprite name.<br>Regexp: " + VALID_NAME_REGEXP.toString());
                    return;
                }
                await __bridge__.createSprite(path, name, extension);
                await refreshSprites();
                clearInterval(interval);
                hidePopup();
            }, "#25e025"]
        ]);
        showPopup();
        const nameDiv = document.getElementById("sprite-name");
        let lastN = "";
        let interval = setInterval(() => {
            if (lastN === nameDiv.value) return;
            nameDiv.value = nameDiv.value.replaceAll(INVALID_NAME_REGEXP, "");
            lastN = nameDiv.value;
        });
    });
    spritesDiv.appendChild(div);
    spriteObjects = [];
    for (const spr of cachedSprites) {
        spriteObjects.push({
            name: spr.name,
            x: spr.x,
            y: spr.y,
            z: spr.z,
            scaleX: spr.scaleX,
            scaleY: spr.scaleY,
            rotation: spr.rotation,
            opacity: spr.opacity
        });
    }
    spriteImages = {};
    for (const spr of cachedSprites) {
        const img = new Image();
        img.src = path + "/sprites/images/" + spr.name + ".png";
        spriteImages[spr.name] = img;
    }
    await updateSelectSprite(selectedSprite, true);
}

await refreshSprites();

addEventListener("focus", async () => {
    if (await __bridge__.isProjectMissing(path)) location.href = redirectTo("index", "");
    if (currentWorker) return;
    await refreshSprites();
});

function onCodeUpdate() {
    lastPropCode = loadedEditor.getValue();
    saveText.innerText = "Saving...";
    clearTimeout(saveTimeout);
    clearTimeout(saveClearTimeout);
    saveTimeout = setTimeout(async () => {
        saveText.innerText = "Saved.";
        saveClearTimeout = setTimeout(() => {
            saveText.innerText = "";
        }, 250);
        if (!selectedSprite) return;
        await __bridge__.saveScriptCode(path, selectedSprite, lastPropCode);
    }, 250);
}

if (engineSettings.monacoEditor) {
    // noinspection JSFileReferences, JSUnresolvedReference
    require.config({paths: {"vs": "../../../node_modules/monaco-editor/min/vs"}});

    require(["vs/editor/editor.main"], async () => {
        const editor = monaco.editor.create(codeDiv, {
            value: "",
            language: "javascript",
            theme: "vs-dark"
        });
        loadedEditor = editor;
        editor.onDidChangeModelContent(onCodeUpdate);
        monaco.languages.typescript.typescriptDefaults.addExtraLib(`
type Mouse = {
  x: number
  y: number
  down: Record<0 | 1 | 2, boolean>
};
type Keyboard = {
  keys: Record<string, boolean>
};
type Input = {
  mouse: Mouse
  keyboard: Keyboard
};
type Screen = {
  width: number
  height: number
};
type Sprite = {
  name: string
  x: number
  y: number
  z: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
};
declare global {
  const Input: Input;
  const Screen: Screen;
  const sprite: Sprite;
}
`, "file.d.ts");

        function onResize() {
            const rect = codeDiv.getBoundingClientRect();
            editor.layout({width: rect.width, height: rect.height});
        }

        onResize();
        addEventListener("resize", onResize);
        await updateSelectSprite(selectedSprite, true);
    });
} else {
    const textarea = document.createElement("textarea");
    textarea.spellcheck = false;
    codeDiv.appendChild(textarea);
    loadedEditor = {
        updateOptions: opts => {
            Object.assign(textarea, opts);
        },
        setValue: value => textarea.value = value,
        getValue: () => textarea.value
    };
    let last;
    setInterval(() => {
        if (last === textarea.value) return;
        last = textarea.value;
        onCodeUpdate();
    });
    await updateSelectSprite(selectedSprite, true);
}

function render() {
    const rect = sceneDiv.getBoundingClientRect();
    const W = canvas.width = rect.width;
    const H = canvas.height = rect.height;
    for (const spr of spriteObjects) {
        if (spr.opacity <= 0) continue;
        const img = spriteImages[spr.name];
        if (img) {
            ctx.save();
            ctx.translate(spr.x + W / 2 - img.width / 2, -spr.y + H / 2 - img.height / 2);
            ctx.scale(spr.scaleX, spr.scaleY);
            if (spr.rotation !== 0) ctx.rotate(spr.rotation);
            if (spr.opacity !== 1) ctx.globalAlpha = spr.opacity;
            try {
                ctx.drawImage(img, -img.width / 2, -img.height / 2);
            } catch (e) {
            }
            ctx.restore();
        }
    }
    if (selectedSprite && currentWorker) {
        const spr = spriteObjects.find(i => i.name === selectedSprite);
        propXDiv.value = spr.x;
        propYDiv.value = spr.y;
        propOpacityDiv.value = spr.opacity;
    }
    requestAnimationFrame(render);
}

render();

function logToTerminal(msg) {
    if (!msg) return;
    const line = document.createElement("div");
    line.classList.add("line");
    const start = msg.match(/^ +/);
    if (start) line.innerHTML += "&nbsp;".repeat(start[0].length);
    line.innerText += msg.trimStart();
    terminalDiv.appendChild(line);
    terminalDiv.scrollTop = terminalDiv.scrollHeight;
}

window.startGame = async function startGame() {
    await stopGame();
    await refreshSprites();
    stopBtn.hidden = false;
    for (let i = 0; i < cachedSprites.length; i++) {
        const spr = cachedSprites[i];
        spriteObjects[i].code = await __bridge__.fetchSpriteCode(path, spr.name);
    }
    const worker = new Worker("./worker.js");
    currentWorker = worker;
    worker.postMessage(spriteObjects);
    worker.addEventListener("message", async ev => {
        if (ev.data.terminate) {
            delete ev.data.terminate;
            spriteObjects = ev.data.sprites;
            if (ev.data.error) ev.data.error.split("\n").forEach(i => logToTerminal(i));
            await stopGame();
            await updateSelectSprite(selectedSprite, true);
            return;
        }
        if (ev.data.error) {
            ev.data.error.split("\n").forEach(i => logToTerminal(i));
            return;
        }
        if (ev.data.debug) {
            ev.data.debug.forEach(i => logToTerminal(i));
            return;
        }
        spriteObjects = ev.data;
    });
    updateWorkerMouse();
    updateWorkerScreen();
};

window.stopGame = async function stopGame() {
    if (currentWorker) currentWorker.terminate();
    currentWorker = null;
    for (let i = 0; i < spriteObjects.length; i++) {
        delete spriteObjects[i].id;
    }
    stopBtn.hidden = true;
    await __bridge__.setBulkSpriteProperties(path, spriteObjects);
    await updateSelectSprite(selectedSprite);
    await refreshSprites();
};

window.selectSpriteImage = async function selectSpriteImage() {
    if (!selectedSprite) return;
    try {
        const [fileHandle] = await showOpenFilePicker({
            types: [
                {
                    description: "Images",
                    accept: {
                        "image/*": [".jpg", ".jpeg", ".png"],
                    }
                }
            ]
        });
        const file = await fileHandle.getFile();
        const reader = new FileReader();
        reader.onload = async event => {
            /*** @type {ArrayBuffer} */
            const content = event.target.result;
            await __bridge__.setSpriteImage(path, selectedSprite, new Int8Array(content));
            setPopupText("Sprite's image has been updated!");
            showPopup();
            await refreshSprites();
        };
        reader.readAsArrayBuffer(file);
    } catch (error) {
        console.error(error);
    }
};

setInterval(async () => {
    if (!selectedSprite) return;
    const sprite = spriteObjects.find(i => i.name === selectedSprite);
    if (!sprite) return;
    let upd = false;
    if (lastPropXDivVal !== (propXDiv.value * 1) || 0) {
        lastPropXDivVal = sprite.x = (propXDiv.value * 1) || 0;
        upd = true;
    }
    if (lastPropYDivVal !== (propYDiv.value * 1) || 0) {
        lastPropYDivVal = sprite.y = (propYDiv.value * 1) || 0;
        upd = true;
    }
    if (lastPropOpacityDivVal !== (propOpacityDiv.value * 1) || 0) {
        lastPropOpacityDivVal = sprite.opacity = (propOpacityDiv.value * 1) || 0;
        upd = true;
    }
    if (upd) {
        if (currentWorker) currentWorker.postMessage(spriteObjects);
        await __bridge__.setSpriteProperties(path, selectedSprite, sprite);
    }
});

function updateWorkerMouse() {
    if (!currentWorker) return;
    mouse.x = mouse.__x - canvas.width / 2;
    mouse.y = -mouse.__y + canvas.height / 2;
    currentWorker.postMessage({
        event: "mouse",
        data: mouse
    });
}

function updateWorkerScreen() {
    if (!currentWorker) return;
    currentWorker.postMessage({
        event: "screen",
        data: {width: canvas.width, height: canvas.height}
    });
}

const mouse = {__x: 0, __y: 0, x: 0, y: 0, down: {}};
sceneDiv.addEventListener("mousedown", e => {
    mouse.down[e.button] = true;
    updateWorkerMouse();
});
sceneDiv.addEventListener("mousemove", e => {
    mouse.__x = e.offsetX;
    mouse.__y = e.offsetY;
    updateWorkerMouse();
});
addEventListener("mouseup", e => {
    mouse.down[e.button] = false;
    updateWorkerMouse();
});

stopBtn.hidden = true;

addEventListener("resize", () => {
    updateWorkerMouse();
    updateWorkerScreen();
});

// todo: sprite.zIndex = 10;