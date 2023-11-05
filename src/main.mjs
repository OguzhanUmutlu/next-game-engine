import {app, BrowserWindow, dialog, ipcMain, Menu, MenuItem, shell} from "electron";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

await app.whenReady();

const RECENT_PROJECTS = "./recent_projects.json";
const DEFAULT_PROJECT_PATH = path.join(os.homedir(), "NextProjects");

if (!fs.existsSync(RECENT_PROJECTS)) fs.writeFileSync(RECENT_PROJECTS, "{}");
else if (!fs.statSync(RECENT_PROJECTS).isFile()) fs.rmSync(RECENT_PROJECTS, {recursive: true});

const Data = {
    copySync: (from, dest) => {
        const fromStat = fs.statSync(from);
        if (fs.existsSync(dest)) fs.rmSync(dest, {recursive: true});
        if (fromStat.isFile()) {
            return fs.copyFileSync(from, dest);
        }
        const files = fs.readdirSync(from);
        fs.mkdirSync(dest);
        for (let i = 0; i < files.length; i++) {
            Data.copySync(from + "/" + files[i], dest + "/" + files[i])
        }
    },
    addToTrashFolder: (p, file, from) => {
        const trashPath = path.join(p, "trash");
        if (fs.existsSync(trashPath) && !fs.statSync(trashPath).isDirectory()) fs.rmSync(trashPath, {recursive: true});
        if (!fs.existsSync(trashPath)) fs.mkdirSync(trashPath, {recursive: true});

        const ext = path.extname(file);
        let trashLoc = path.join(trashPath, file.slice(0, -ext.length));
        let nmA = 0;
        while (fs.existsSync(trashLoc + (nmA || "") + ext)) {
            nmA++;
        }
        trashLoc += (nmA || "") + ext;
        Data.copySync(from, trashLoc);
    },
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
    addRecentProject: p => {
        const recents = Data.getRecentProjects();
        recents[p] = Date.now();
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
        const nextFile = path.join(p, ".next");
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
        fs.writeFileSync(path.join(p, ".next"), JSON.stringify({
            name: path.basename(p),
            path: p,
            editedTimestamp: Date.now(),
            createdTimestamp: Date.now()
        }));
        fs.mkdirSync(path.join(p, "sprites"), {recursive: true});
        fs.writeFileSync(path.join(p, "sprites", "My Sprite.js"), "console.log('Hello, world!')\n\nsprite.x += 10");
        fs.writeFileSync(path.join(p, "sprites", "sprites.json"), JSON.stringify([
            {
                name: "My Sprite",
                extension: ".js",
                x: 0,
                y: 0,
                z: 0,
                scaleX: 1,
                scaleY: 1,
                rotation: 0,
                opacity: 1,
                createdTimestamp: Date.now()
            }
        ]));
        Data.updateRecentProject(p);
    },
    updateProjectEditedTimestamp: p => {
        const next = Data.fetchProject(p);
        if (next.missing) return;
        next.editedTimestamp = Date.now();
        const nextFile = path.join(p, ".next");
        fs.writeFileSync(nextFile, JSON.stringify(next));
    },
    fetchSprites: p => {
        if (Data.isProjectMissing(p)) return null;
        const spritesPath = path.join(p, "sprites");
        if (fs.existsSync(spritesPath) && !fs.statSync(spritesPath).isDirectory()) fs.rmSync(spritesPath, {recursive: true});
        if (!fs.existsSync(spritesPath)) fs.mkdirSync(spritesPath, {recursive: true});
        const spritesMetaPath = path.join(spritesPath, "sprites.json");
        if (fs.existsSync(spritesMetaPath) && !fs.statSync(spritesMetaPath).isFile()) fs.rmSync(spritesMetaPath, {recursive: true});
        if (!fs.existsSync(spritesMetaPath)) fs.writeFileSync(spritesMetaPath, "[]");
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
                const spritePath = path.join(p, "sprites", spr.name + spr.extension);
                if (fs.existsSync(spritePath) && !fs.statSync(spritePath).isFile()) fs.rmSync(spritePath, {recursive: true});
                if (!fs.existsSync(spritePath)) {
                    fs.writeFileSync(spritePath, "");
                    return "";
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
                const spritePath = path.join(p, "sprites", spr.name + spr.extension);
                if (fs.existsSync(spritePath) && !fs.statSync(spritePath).isFile()) fs.rmSync(spritePath, {recursive: true});
                return fs.writeFileSync(spritePath, code);
            }
        }
    },
    createSprite: (p, name, extension) => {
        if (Data.isProjectMissing(p)) return;
        const sprites = Data.fetchSprites(p);
        if (!sprites) return null;
        for (const spr of sprites) {
            if (spr.name === name) return;
        }
        let spritePath = path.join(p, "sprites", name + extension);
        const imagePath = path.join(p, "sprites", "images");
        const spriteImagePath = path.join(imagePath, name + ".png");
        if (fs.existsSync(spritePath)) {
            Data.addToTrashFolder(p, name + extension, spritePath);
            fs.rmSync(spritePath, {recursive: true});
        }
        fs.writeFileSync(spritePath, "console.log('Hello, world!')\n\nsprite.x += 10");
        if (fs.existsSync(imagePath) && !fs.statSync(imagePath).isDirectory()) fs.rmSync(imagePath, {recursive: true});
        if (!fs.existsSync(imagePath)) fs.mkdirSync(imagePath, {recursive: true});
        fs.copyFileSync(__dirname + "/src/assets/sprite.png", spriteImagePath);
        sprites.push({
            name,
            extension,
            x: 0,
            y: 0,
            z: sprites.length,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1,
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
        const spriteCodePath = path.join(p, "sprites", found.name + found.extension);
        if (fs.existsSync(spriteCodePath)) {
            Data.addToTrashFolder(p, found.name + found.extension, spriteCodePath);
            fs.rmSync(spriteCodePath);
        }
        const spriteImagePath = path.join(p, "sprites", "images", found.name + ".png");
        if (fs.existsSync(spriteImagePath)) {
            Data.addToTrashFolder(p, found.name + ".png", spriteImagePath);
            fs.rmSync(spriteImagePath);
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
    },
    setSpriteImage: (p, name, buffer) => {
        if (Data.isProjectMissing(p)) return;
        const sprites = Data.fetchSprites(p);
        if (!sprites) return null;
        for (const spr of sprites) {
            if (spr.name === name) {
                const imagesPath = path.join(p, "sprites", "images");
                if (fs.existsSync(imagesPath) && !fs.statSync(imagesPath).isDirectory()) fs.rmSync(imagesPath, {recursive: true});
                if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath);
                const spritePath = path.join(p, "sprites", "images", spr.name + ".png");
                if (fs.existsSync(spritePath) && !fs.statSync(spritePath).isFile()) fs.rmSync(spritePath, {recursive: true});
                return fs.writeFileSync(spritePath, buffer);
            }
        }
    },
    createMissingSpriteImages: p => {
        if (Data.isProjectMissing(p)) return;
        const sprites = Data.fetchSprites(p);
        if (!sprites) return null;
        for (const spr of sprites) {
            const imagesPath = path.join(p, "sprites", "images");
            if (fs.existsSync(imagesPath) && !fs.statSync(imagesPath).isDirectory()) fs.rmSync(imagesPath, {recursive: true});
            if (!fs.existsSync(imagesPath)) fs.mkdirSync(imagesPath);
            const spritePath = path.join(p, "sprites", "images", spr.name + ".png");
            if (fs.existsSync(spritePath) && !fs.statSync(spritePath).isFile()) fs.rmSync(spritePath, {recursive: true});
            if (fs.existsSync(spritePath)) continue;
            fs.copyFileSync(__dirname + "/src/assets/sprite.png", spritePath);
        }
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
ipcMain.handle("createSprite", (_, p, name, extension) => Data.createSprite(p, name, extension));
ipcMain.handle("deleteSprite", (_, p, name) => Data.deleteSprite(p, name));
ipcMain.handle("setSpriteProperties", (_, p, name, props = {}) => Data.setSpriteProperties(p, name, props));
ipcMain.handle("setBulkSpriteProperties", (_, p, spritesNew = []) => Data.setBulkSpriteProperties(p, spritesNew));
ipcMain.handle("setSpriteImage", (_, p, name, buffer) => Data.setSpriteImage(p, name, buffer));
ipcMain.handle("createMissingSpriteImages", (_, p) => Data.createMissingSpriteImages(p));
ipcMain.handle("openProjectPopup", async () => {
    const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
            {name: "Next file", extensions: ["next"]}
        ]
    });
    if (result.canceled) return;
    Data.addRecentProject(path.dirname(result.filePaths[0].replaceAll("\\", "/")));
});

const win = new BrowserWindow({
    show: false,
    minWidth: 1000,
    minHeight: 700,
    width: 1000,
    height: 700,
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
projectMenu.append(new MenuItem({
    label: "Refresh", async click() {
        win.webContents.reload();
    }
}));
projectMenu.append(new MenuItem({
    label: "Settings", async click() {
        await win.webContents.executeJavaScript("window.settingsPopup()");
    }
}));
projectMenu.append(new MenuItem({
    label: "DevTools", async click() {
        win.webContents.toggleDevTools();
    }
}));
projectMenu.append(new MenuItem({
    label: "Force stop", async click() {
        await win.webContents.executeJavaScript("window.stop()");
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
        //win.webContents.closeDevTools();
    }
});

win.setMenu(null);
win.maximize();
await win.loadFile(__dirname + "/src/pages/index/index.html");
win.show();