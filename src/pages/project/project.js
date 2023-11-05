const query = new URLSearchParams(location.search);
const path = query.get("path");
if (await __bridge__.isProjectMissing(path)) location.href = redirectTo("index", "");
await __bridge__.updateProjectEditedTimestamp(path);
const project = await __bridge__.fetchProject(path);
document.title = "Next Game Engine - " + project.name;

const spritesDiv = document.querySelector(".sprite-container");
const codeDiv = document.querySelector(".code");
const saveText = document.querySelector(".save-text");
const sceneDiv = document.querySelector(".scene");
const sceneFullDiv = document.querySelector(".scene-full");
const propXDiv = document.getElementById("prop-x");
const propYDiv = document.getElementById("prop-y");
const propOpacityDiv = document.getElementById("prop-opacity");
const propScaleXDiv = document.getElementById("prop-scaleX");
const propScaleYDiv = document.getElementById("prop-scaleY");
const stopBtn = document.querySelectorAll(".stop");
const terminalDiv = document.querySelector(".terminal");
const spriteHoldDiv = document.querySelector(".holding-sprite");
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
let spriteImageId = {};
let cachedSprites = [];
let lastPropCode = "";
let lastPropXDivVal = "";
let lastPropYDivVal = "";
let lastPropOpacityDivVal = "";
let lastPropScaleXDivVal = "";
let lastPropScaleYDivVal = "";
let holdingSprite = null;
let holdingSpriteOffset = null;
let fps = 0;
let lastRender = Date.now() - 1;

function loadSpriteImage(name) {
    const img = new Image();
    img.src = path + "/sprites/images/" + name + ".png?t=" + spriteImageId[name];
    spriteImages[name] = img;
}

async function updateSelectSprite(name) {
    if (!loadedEditor || !cachedSprites || !spriteObjects) return;
    if (!name || !cachedSprites.some(i => i.name === name)) {
        name = (cachedSprites[0] ?? {name: null}).name;
    }
    loadedEditor.updateOptions({readOnly: !name});
    propXDiv.readOnly = !name;
    propYDiv.readOnly = !name;
    propOpacityDiv.readOnly = !name;
    propScaleXDiv.readOnly = !name;
    propScaleYDiv.readOnly = !name;
    const sprite = spriteObjects.find(i => i.name === name);
    const cachedSprite = cachedSprites.find(i => i.name === name);
    const code = await __bridge__.fetchSpriteCode(path, name);
    if (!sprite || !cachedSprite || code === null) {
        selectedSprite = null;
        loadedEditor.setValue("");
        propXDiv.value = "";
        propYDiv.value = "";
        propOpacityDiv.value = "";
        propScaleXDiv.value = "";
        propScaleYDiv.value = "";
        if (name) await refreshSprites();
        return;
    }
    const switchedSprite = selectedSprite !== name;
    if (switchedSprite) {
        saveText.innerText = "";
        clearTimeout(saveTimeout);
        clearTimeout(saveClearTimeout);
        if (!loadedEditor.__textarea) {
            monaco.editor.setModelLanguage(loadedEditor.getModel(), cachedSprite.extension === ".js" ? "javascript" : "python");
        }
    }
    if (switchedSprite || lastPropXDivVal !== sprite.x) propXDiv.value = sprite.x;
    if (switchedSprite || lastPropYDivVal !== sprite.y) propYDiv.value = sprite.y;
    if (switchedSprite || lastPropOpacityDivVal !== sprite.opacity) propOpacityDiv.value = sprite.opacity;
    if (switchedSprite || lastPropScaleXDivVal !== sprite.scaleX) propScaleXDiv.value = sprite.scaleX;
    if (switchedSprite || lastPropScaleYDivVal !== sprite.scaleY) propScaleYDiv.value = sprite.scaleY;
    lastPropXDivVal = sprite.x;
    lastPropYDivVal = sprite.y;
    lastPropOpacityDivVal = sprite.opacity;
    lastPropScaleXDivVal = sprite.scaleX;
    lastPropScaleYDivVal = sprite.scaleY;
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
        spriteImageId = spriteImageId[sprite.name] ?? Date.now();
        img.src = path + "/sprites/images/" + sprite.name + ".png?t=" + spriteImageId;
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
                    delete spriteImages[sprite.name];
                    delete spriteImageId[sprite.name];
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
            "   <option value='.py'>Python</option>" +
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
                delete spriteImageId[name]; // reset the id so it refreshes the image
                await refreshSprites();
                clearInterval(interval);
                hidePopup();
                loadSpriteImage(name);
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
    for (const spr of cachedSprites.sort((b, a) => a.z - b.z)) {
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
    await updateSelectSprite(selectedSprite, true);
}

await refreshSprites();
for (const spr of cachedSprites) loadSpriteImage(spr.name);

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
        getValue: () => textarea.value,
        __textarea: true
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
    fps = 1000 / (Date.now() - lastRender);
    lastRender = Date.now();
    const rect = sceneDiv.getBoundingClientRect();
    const W = canvas.width = rect.width;
    const H = canvas.height = rect.height;
    for (const spr of spriteObjects) {
        if (spr.opacity <= 0 || holdingSprite === spr) continue;
        const img = spriteImages[spr.name];
        if (img) {
            ctx.save();
            ctx.translate(spr.x + W / 2, -spr.y + H / 2);
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
        propScaleXDiv.value = spr.scaleX;
        propScaleYDiv.value = spr.scaleY;
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
    const children = [...terminalDiv.children];
    for (let i = 1; i < children.length - 100; i++) {
        children[i].remove();
    }
}

window.clearTerminal = function clearTerminal() {
    const children = [...terminalDiv.children];
    for (let i = 1; i < children.length; i++) {
        children[i].remove();
    }
}

window.startGame = async function startGame() {
    await stopGame();
    await refreshSprites();
    for (const btn of stopBtn) btn.hidden = false;
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
    for (const btn of stopBtn) btn.hidden = true;
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
            delete spriteImageId[selectedSprite]; // so that it refreshes the image
            await refreshSprites();
            loadSpriteImage(selectedSprite);
        };
        reader.readAsArrayBuffer(file);
    } catch (error) {
        console.error(error);
    }
};

setInterval(async () => {
    if (currentWorker) {
        currentWorker.postMessage({
            event: "fps",
            data: fps
        });
    }
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
    if (lastPropScaleXDivVal !== (propScaleXDiv.value * 1) || 0) {
        lastPropScaleXDivVal = sprite.scaleX = (propScaleXDiv.value * 1) || 0;
        upd = true;
    }
    if (lastPropScaleYDivVal !== (propScaleYDiv.value * 1) || 0) {
        lastPropScaleYDivVal = sprite.scaleY = (propScaleYDiv.value * 1) || 0;
        upd = true;
    }
    if (upd) {
        if (currentWorker) currentWorker.postMessage(spriteObjects);
        await __bridge__.setSpriteProperties(path, selectedSprite, sprite);
    }
});

function updateWorkerMouse() {
    mouse.x = Math.round(mouse.__x * (isMaximized() ? canvas.width / innerWidth : 1) - canvas.width / 2);
    mouse.y = Math.round(-mouse.__y * (isMaximized() ? canvas.height / innerHeight : 1) + canvas.height / 2);
    if (!currentWorker) return;
    currentWorker.postMessage({
        event: "mouse",
        data: mouse
    });
}

function updateWorkerKeyboard() {
    if (!currentWorker) return;
    currentWorker.postMessage({
        event: "keyboard",
        data: keyboard
    });
}

function isMaximized() {
    return !sceneFullDiv.hidden;
}

function updateWorkerScreen() {
    if (!currentWorker) return;
    currentWorker.postMessage({
        event: "screen",
        data: {width: canvas.width, height: canvas.height, isMaximized: isMaximized()}
    });
}

window.maximizeScene = function maximizeScene() {
    canvas.remove();
    sceneFullDiv.appendChild(canvas);
    sceneFullDiv.hidden = false;
    codeDiv.hidden = true;
};

window.minimizeScene = function minimizeScene() {
    canvas.remove();
    sceneDiv.appendChild(canvas);
    sceneFullDiv.hidden = true;
    codeDiv.hidden = false;
};

function getMouseTouchingSprite() {
    for (let i = spriteObjects.length - 1; i >= 0; i--) {
        const spr = spriteObjects[i];
        const img = spriteImages[spr.name];
        if (!img) continue;
        const w2 = img.width / 2 * spr.scaleX;
        const h2 = img.height / 2 * spr.scaleY;
        const minX = spr.x - w2;
        const maxX = spr.x + w2;
        const minY = spr.y - h2;
        const maxY = spr.y + h2;
        if (
            mouse.x >= minX &&
            mouse.x <= maxX &&
            mouse.y >= minY &&
            mouse.y <= maxY
        ) return spr;
    }
    return null;
}

const mouse = {__x: 0, __y: 0, x: 0, y: 0, down: {}};
let keyboard = {};
canvas.addEventListener("mousedown", e => {
    const max = isMaximized();
    mouse.__x = e.pageX - (max ? 0 : 10);
    mouse.__y = e.pageY - (max ? 0 : 10);
    mouse.down[e.button] = true;
    updateWorkerMouse();
    if (!currentWorker) {
        const sprite = getMouseTouchingSprite();
        if (!sprite) return;
        const img = spriteImages[sprite.name];
        holdingSprite = sprite;
        holdingSpriteOffset = [mouse.x - sprite.x, mouse.y - sprite.y];
        spriteHoldDiv.style.left = (e.pageX - holdingSpriteOffset[0] * (max ? innerWidth / canvas.width : 1)) + "px";
        spriteHoldDiv.style.top = (e.pageY + holdingSpriteOffset[1] * (max ? innerHeight / canvas.height : 1)) + "px";
        spriteHoldDiv.hidden = false;
        spriteHoldDiv.innerHTML = `<img src="${img.src}" draggable="false" style="scale: ${sprite.scaleX * (max ? innerWidth / canvas.width : 1)} ${sprite.scaleY * (max ? innerHeight / canvas.height : 1)}">`;
    }
});
addEventListener("mousemove", e => {
    const max = isMaximized();
    mouse.__x = e.pageX - (max ? 0 : 10);
    mouse.__y = e.pageY - (max ? 0 : 10);
    updateWorkerMouse();
    if (holdingSprite) {
        spriteHoldDiv.style.left = (e.pageX - holdingSpriteOffset[0] * (max ? innerWidth / canvas.width : 1)) + "px";
        spriteHoldDiv.style.top = (e.pageY + holdingSpriteOffset[1] * (max ? innerHeight / canvas.height : 1)) + "px";
    }
});
addEventListener("mouseup", async e => {
    const max = isMaximized();
    mouse.__x = e.pageX - (max ? 0 : 10);
    mouse.__y = e.pageY - (max ? 0 : 10);
    mouse.down[e.button] = false;
    updateWorkerMouse();
    if (holdingSprite) {
        spriteHoldDiv.hidden = true;
        spriteHoldDiv.innerHTML = "";
        const x = holdingSprite.x = mouse.x - holdingSpriteOffset[0];
        const y = holdingSprite.y = mouse.y - holdingSpriteOffset[1];
        if (holdingSprite.name === selectedSprite) {
            lastPropScaleXDivVal = x;
            lastPropScaleYDivVal = y;
            propXDiv.value = x;
            propYDiv.value = y;
        }
        await __bridge__.setSpriteProperties(path, holdingSprite.name, {x, y});
        holdingSprite = null;
    }
});
addEventListener("keydown", e => {
    keyboard[e.key.length > 1 ? e.key : e.key.toLowerCase()] = true;
    updateWorkerKeyboard();
});
addEventListener("keyup", e => {
    keyboard[e.key.length > 1 ? e.key : e.key.toLowerCase()] = false;
    updateWorkerKeyboard();
});
addEventListener("blur", () => {
    keyboard = {};
    updateWorkerKeyboard();
});

for (const btn of stopBtn) btn.hidden = true;
sceneFullDiv.hidden = true;

addEventListener("resize", () => {
    updateWorkerMouse();
    updateWorkerScreen();
});