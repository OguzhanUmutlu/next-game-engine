const query = new URLSearchParams(location.search);
const path = query.get("path");
if (await __bridge__.isProjectMissing(path)) location.href = redirectTo("index", "");

const spritesDiv = document.querySelector(".sprite-container");
const codeDiv = document.querySelector(".code");
const saveText = document.querySelector(".save-text");
const sceneDiv = document.querySelector(".scene");
const propXDiv = document.getElementById("prop-x");
const propYDiv = document.getElementById("prop-y");
const propVisibilityDiv = document.getElementById("prop-visibility");
const canvas = document.querySelector(".scene > canvas");
/*** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext("2d");

let selectedSprite = null;
let loadedEditor;
let lastSelectCode = "";
let lastCode = "";
let saveTimeout;
let saveClearTimeout;
let currentWorker;
let spriteObjects = [];
let cachedSprites = [];

async function updateSelectSprite(name) {
    if (!loadedEditor) return;
    if (selectedSprite !== name) {
        const spr = spriteObjects.find(i => i.name === name);
        propXDiv.value = spr.x;
        propYDiv.value = spr.y;
        saveText.innerText = "";
        clearTimeout(saveTimeout);
        clearTimeout(saveClearTimeout);
    }
    selectedSprite = name;
    loadedEditor.updateOptions({readOnly: !name});
    if (!name) {
        loadedEditor.setValue("");
        return;
    }
    const code = await __bridge__.fetchSpriteCode(path, name);
    if (code === null) {
        selectedSprite = null;
        loadedEditor.setValue("");
        return refreshSprites();
    }
    if (lastSelectCode !== code) loadedEditor.setValue(code);
    lastSelectCode = code;
}

async function refreshSprites() {
    cachedSprites = await __bridge__.fetchSprites(path);
    spritesDiv.innerHTML = "";
    for (const sprite of cachedSprites) {
        const div = document.createElement("div");
        div.classList.add("sprite");
        div.innerText = sprite.name;
        const deleteBtn = document.createElement("div");
        deleteBtn.classList.add("sprite-delete");
        deleteBtn.innerHTML = "<img src='../../assets/delete.png'>";
        deleteBtn.addEventListener("click", async () => {
            await __bridge__.deleteSprite(path, sprite.name);
            await refreshSprites();
        });
        div.appendChild(deleteBtn);
        div.addEventListener("click", () => updateSelectSprite(sprite.name));
        spritesDiv.appendChild(div);
    }
    const div = document.createElement("div");
    div.classList.add("sprite");
    div.innerText = "+";
    div.addEventListener("click", () => {
        setPopupText("<h1>Add sprite</h1><input id='sprite-name' style='font-size: 16px' placeholder='Sprite name...'>", [
            ["Cancel", hidePopup],
            ["Create", async () => {
                const name = document.getElementById("sprite-name").value;
                await __bridge__.createSprite(path, name);
                await refreshSprites();
                hidePopup();
            }, "#25e025"]
        ]);
        showPopup();
    });
    spritesDiv.appendChild(div);
    spriteObjects = [];
    for (const spr of cachedSprites) {
        spriteObjects.push({
            name: spr.name,
            x: spr.x,
            y: spr.y,
            z: spr.z,
            visibility: spr.visibility
        });
    }
    await updateSelectSprite(selectedSprite ?? (cachedSprites[0] ?? {name: null}).name);
}

await refreshSprites();

addEventListener("focus", async () => {
    if (await __bridge__.isProjectMissing(path)) location.href = redirectTo("index", "");
    if (currentWorker) return;
    await refreshSprites();
});

// noinspection JSFileReferences, JSUnresolvedReference
require.config({paths: {"vs": "../../../node_modules/monaco-editor/min/vs"}});

require(["vs/editor/editor.main"], async () => {
    const editor = monaco.editor.create(codeDiv, {
        value: "",
        language: "javascript",
        theme: "vs-dark"
    });
    loadedEditor = editor;
    editor.onDidChangeModelContent(function () {
        lastCode = editor.getValue();
        saveText.innerText = "Saving...";
        clearTimeout(saveTimeout);
        clearTimeout(saveClearTimeout);
        saveTimeout = setTimeout(async () => {
            saveText.innerText = "Saved.";
            saveClearTimeout = setTimeout(() => {
                saveText.innerText = "";
            }, 250);
            if (!selectedSprite) return;
            await __bridge__.saveScriptCode(path, selectedSprite, lastCode);
        }, 250);
    });
    await updateSelectSprite(selectedSprite);
});

function render() {
    const rect = sceneDiv.getBoundingClientRect();
    const W = canvas.width = rect.width;
    const H = canvas.height = rect.height;
    for (const spr of spriteObjects) {
        ctx.beginPath();
        ctx.arc(spr.x + W / 2, -spr.y + H / 2, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
    }
    if (selectedSprite && currentWorker) {
        const spr = spriteObjects.find(i => i.name === selectedSprite);
        propXDiv.value = spr.x;
        propYDiv.value = spr.y;
    }
    requestAnimationFrame(render);
}

render();

window.startGame = async function startGame() {
    await stopGame();
    await refreshSprites();
    for (let i = 0; i < cachedSprites.length; i++) {
        const spr = cachedSprites[i];
        spriteObjects[i].code = await __bridge__.fetchSpriteCode(path, spr.name);
    }
    const worker = new Worker("./worker.js");
    currentWorker = worker;
    worker.postMessage(spriteObjects);
    worker.addEventListener("message", ev => {
        spriteObjects = ev.data;
    });
};

window.stopGame = async function stopGame() {
    if (currentWorker) currentWorker.terminate();
    currentWorker = null;
    await __bridge__.setBulkSpriteProperties(path, spriteObjects);
    await refreshSprites();
};

propXDiv.addEventListener("change", () => {
    if (!selectedSprite) return;
    spriteObjects.find(i => i.name === selectedSprite).x = propXDiv.value * 1;
    if (currentWorker) currentWorker.postMessage(spriteObjects);
});

propYDiv.addEventListener("change", () => {
    if (!selectedSprite) return;
    spriteObjects.find(i => i.name === selectedSprite).y = propXDiv.value * 1;
    if (currentWorker) currentWorker.postMessage(spriteObjects);
});

// todo: sprite.zIndex = 10;