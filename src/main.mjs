import {app, BrowserWindow, ipcMain, Menu, MenuItem, shell} from "electron";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

await app.whenReady();

const RECENT_PROJECTS = "./recent_projects.json";
const DEFAULT_PROJECT_PATH = path.join(os.homedir(), "NextProjects");

if (!fs.existsSync(RECENT_PROJECTS)) fs.writeFileSync(RECENT_PROJECTS, "{}");
else if (!fs.statSync(RECENT_PROJECTS).isFile()) fs.rmSync(RECENT_PROJECTS, {recursive: true});

const Data = {
    getRecentProjects: () => JSON.parse(fs.readFileSync(RECENT_PROJECTS, "utf8")),
    updateRecentProject: p => {
        const recents = Data.getRecentProjects();
        recents[p] = Date.now();
        fs.writeFileSync(RECENT_PROJECTS, JSON.stringify(recents));
    },
    deleteRecentProject: p => {
        const recents = Data.getRecentProjects();
        delete recents[p];
        fs.writeFileSync(RECENT_PROJECTS, JSON.stringify(recents));
    },
    isProjectMissing: p => {
        return !fs.existsSync(p) || !fs.statSync(p).isDirectory();
    },
    fetchProject: p => {
        const defaultNext = {
            name: path.basename(p),
            createdTimestamp: Date.now(),
            editedTimestamp: Date.now(),
            path: p
        };
        if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) return {...defaultNext, missing: true};
        const nextFile = path.join(p, ".meta");
        if (fs.existsSync(nextFile)) {
            if (!fs.statSync(nextFile).isFile()) fs.rmSync(nextFile, {recursive: true});
            else {
                try {
                    return {
                        ...defaultNext,
                        ...JSON.parse(fs.readFileSync(nextFile, "utf8"))
                    };
                } catch (e) {
                    console.log(e);
                    console.log("Failed to parse the JSON: " + nextFile);
                }
            }
        }
        fs.writeFileSync(nextFile, JSON.stringify(defaultNext));
        return defaultNext;
    },
    createProject: (name, p) => {
        if (fs.existsSync(p)) return null;
        fs.mkdirSync(p, {recursive: true});
        fs.writeFileSync(path.join(p, ".meta"), JSON.stringify({
            name: path.basename(p),
            path: p,
            createdTimestamp: Date.now()
        }));
        fs.mkdirSync(path.join(p, "sprites"));
        fs.writeFileSync(path.join(p, "sprites", "My Sprite.js"), "console.log('Hello, world!')");
        fs.writeFileSync(path.join(p, "sprites", "sprites.json"), JSON.stringify([
            {name: "My Sprite", file: "My Sprite.js", position: 0, createdTimestamp: Date.now()}
        ]));
        Data.updateRecentProject(p);
    },
    updateProjectEditedTimestamp: p => {
        const next = Data.fetchProject(p);
        if (next.missing) return;
        next.editedTimestamp = Date.now();
        const nextFile = path.join(p, ".meta");
        fs.writeFileSync(nextFile, JSON.stringify(next));
    },
    fetchSprites: p => {
        const spritesPath = path.join(p, "sprites");
        if (!fs.existsSync(spritesPath) || !fs.statSync(spritesPath).isDirectory()) return null;
        const spritesMetaPath = path.join(spritesPath, "sprites.json");
        if (fs.existsSync(spritesMetaPath) && !fs.statSync(spritesMetaPath).isFile()) fs.rmSync(spritesMetaPath, {recursive: true});
        if (!fs.existsSync(spritesMetaPath)) fs.writeFileSync(spritesMetaPath, "{}");
        let spriteMeta;
        try {
            spriteMeta = JSON.parse(fs.readFileSync(spritesMetaPath, "utf8"))
        } catch (e) {
            console.log(e);
            console.log("Failed to parse the JSON: " + spritesMetaPath);
            return [];
        }
        return spriteMeta;
    },
    fetchSpriteCode: (p, name) => {
        if (Data.isProjectMissing(p)) return null;
        const sprites = Data.fetchSprites(p);
        if (!sprites) return null;
        for (const spr of sprites) {
            if (spr.name === name) {
                const spritePath = path.join(p, "sprites", spr.file);
                if (!fs.existsSync(spritePath) || !fs.statSync(spritePath).isFile()) {
                    console.log("Failed to read the code of the sprite: " + spritePath);
                    return null;
                }
                return fs.readFileSync(spritePath, "utf8");
            }
        }
        return null;
    },
    saveScriptCode: (p, name, code) => {
        if (Data.isProjectMissing(p)) return;
        const sprites = Data.fetchSprites(p);
        if (!sprites) return null;
        for (const spr of sprites) {
            if (spr.name === name) {
                const spritePath = path.join(p, "sprites", spr.file);
                if (fs.existsSync(spritePath) && !fs.statSync(spritePath).isFile()) {
                    console.log("Unexpected directory for the sprite file: " + spritePath);
                    return;
                }
                return fs.writeFileSync(spritePath, code);
            }
        }
    },
    createSprite: (p, name) => {
        if (Data.isProjectMissing(p)) return;
        const sprites = Data.fetchSprites(p);
        if (!sprites) return null;
        for (const spr of sprites) {
            if (spr.name === name) return;
        }
        let spritePath = path.join(p, "sprites", name);
        let nmA = 0;
        while (fs.existsSync(spritePath + (nmA || "") + ".js")) {
            nmA++;
        }
        spritePath += (nmA || "") + ".js";
        fs.writeFileSync(spritePath, "console.log('Hello, world!');\nsprite.x += 10;");
        sprites.push({
            name,
            file: name + (nmA || "") + ".js",
            x: 0,
            y: 0,
            z: sprites.length,
            visibility: true,
            createdTimestamp: Date.now()
        });
        const spritesPath = path.join(p, "sprites");
        const spritesMetaPath = path.join(spritesPath, "sprites.json");
        fs.writeFileSync(spritesMetaPath, JSON.stringify(sprites));
    },
    deleteSprite: (p, name) => {
        if (Data.isProjectMissing(p)) return;
        const sprites = Data.fetchSprites(p);
        if (!sprites) return null;
        let found;
        for (let i = 0; i < sprites.length; i++) {
            const spr = sprites[i];
            if (spr.name === name) {
                found = spr;
                sprites.splice(i, 1);
                break;
            }
        }
        if (!found) return;
        const spriteActualPath = path.join(p, "sprites", found.file);
        if (fs.existsSync(spriteActualPath) && fs.statSync(spriteActualPath).isFile()) {
            const trashPath = path.join(p, "sprites", "trash");
            if (fs.existsSync(trashPath) && !fs.statSync(trashPath).isDirectory()) fs.rmSync(trashPath, {recursive: true});
            if (!fs.existsSync(trashPath)) fs.mkdirSync(trashPath);
            const ext = path.extname(found.file);
            let spritePath = path.join(trashPath, found.file.slice(0, -ext.length));
            let nmA = 0;
            while (fs.existsSync(spritePath + (nmA || "") + ext)) {
                nmA++;
            }
            spritePath += (nmA || "") + ext;
            fs.writeFileSync(spritePath, fs.readFileSync(spriteActualPath));
            fs.rmSync(spriteActualPath);
        }
        for (let i = 0; i < sprites.length; i++) {
            const spr = sprites[i];
            if (spr.z > found.z) {
                spr.z--;
            }
        }
        const spritesPath = path.join(p, "sprites");
        const spritesMetaPath = path.join(spritesPath, "sprites.json");
        fs.writeFileSync(spritesMetaPath, JSON.stringify(sprites));
    },
    setSpriteProperties: (p, name, props = {}) => {
        if (Data.isProjectMissing(p)) return;
        const sprites = Data.fetchSprites(p);
        if (!sprites) return null;
        let found;
        for (let i = 0; i < sprites.length; i++) {
            const spr = sprites[i];
            if (spr.name === name) {
                found = spr;
                break;
            }
        }
        if (!found) return;
        Object.assign(found, props);
        const spritesPath = path.join(p, "sprites");
        const spritesMetaPath = path.join(spritesPath, "sprites.json");
        fs.writeFileSync(spritesMetaPath, JSON.stringify(sprites));
    },
    setBulkSpriteProperties: (p, spritesNew = []) => {
        if (Data.isProjectMissing(p)) return;
        const sprites = Data.fetchSprites(p);
        if (!sprites) return null;
        for (let i = 0; i < sprites.length; i++) {
            for (let j = 0; j < spritesNew.length; j++) {
                const spr1 = sprites[i];
                const spr2 = spritesNew[j];
                if (spr1.name === spr2.name) {
                    Object.assign(spr1, spr2);
                    break;
                }
            }
        }
        const spritesPath = path.join(p, "sprites");
        const spritesMetaPath = path.join(spritesPath, "sprites.json");
        fs.writeFileSync(spritesMetaPath, JSON.stringify(sprites));
    }
};

ipcMain.handle("getRecentProjects", () => {
    const projects = [];
    const recent = Data.getRecentProjects();
    for (const p in recent) {
        const data = Data.fetchProject(p);
        projects.push(data);
    }
    return projects;
});

ipcMain.handle("createProject", (_, name, p) => Data.createProject(name, p));
ipcMain.handle("getDefaultProjectPath", () => DEFAULT_PROJECT_PATH);
ipcMain.handle("fetchProject", (_, p) => Data.fetchProject(p));
ipcMain.handle("deleteRecentProject", (_, p) => Data.deleteRecentProject(p));
ipcMain.handle("updateProjectEditedTimestamp", (_, p) => {
    Data.updateProjectEditedTimestamp(p);
    Data.updateRecentProject(p);
});
ipcMain.handle("fetchSprites", (_, p) => Data.fetchSprites(p));
ipcMain.handle("fetchSpriteCode", (_, p, name) => Data.fetchSpriteCode(p, name));
ipcMain.handle("isProjectMissing", (_, p) => Data.isProjectMissing(p));
ipcMain.handle("openInExplorer", (_, p) => shell.openPath(os.platform() === "win32" ? p.replaceAll("/", "\\") : p));
ipcMain.handle("saveScriptCode", (_, p, name, code) => Data.saveScriptCode(p, name, code));
ipcMain.handle("createSprite", (_, p, name) => Data.createSprite(p, name));
ipcMain.handle("deleteSprite", (_, p, name) => Data.deleteSprite(p, name));
ipcMain.handle("setSpriteProperties", (_, p, name, props = {}) => Data.setSpriteProperties(p, name, props));
ipcMain.handle("setBulkSpriteProperties", (_, p, spritesNew = []) => Data.setBulkSpriteProperties(p, spritesNew));

const win = new BrowserWindow({
    show: false,
    minWidth: 700,
    minHeight: 600,
    width: 700,
    height: 600,
    webPreferences: {
        preload: __dirname + "/src/bridge.js"
    }
});

const projectMenu = new Menu();
projectMenu.append(new MenuItem({
    label: "Close", async click() {
        await win.loadFile(__dirname + "/src/pages/index/index.html");
    }
}));
projectMenu.append(new MenuItem({
    label: "Open in explorer", async click() {
        if (!winQuery.path) return;
        await shell.openPath(os.platform() === "win32" ? winQuery.path.replaceAll("/", "\\") : winQuery.path);
    }
}));

let winPath = "index.html";
let winQuery = {};
ipcMain.on("pathname", (_, path, query) => {
    winPath = path;
    winQuery = query;
    if (path.endsWith("project.html")) {
        win.setMenu(projectMenu);
    } else {
        win.setMenu(null);
    }
});

win.setMenu(null);
win.maximize();
await win.loadFile(__dirname + "/src/pages/index/index.html");
win.webContents.openDevTools();
win.show();