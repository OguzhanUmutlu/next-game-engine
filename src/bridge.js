const {ipcRenderer, contextBridge} = require("electron");

const query = {};
[...new URLSearchParams(location.search).entries()].forEach(i => query[i[0]] = i[1]);
ipcRenderer.send("pathname", location.pathname, query);

const API = {
    getRecentProjects: () => ipcRenderer.invoke("getRecentProjects"),
    createProject: (name, path) => ipcRenderer.invoke("createProject", name, path),
    getDefaultProjectPath: () => ipcRenderer.invoke("getDefaultProjectPath"),
    fetchProject: path => ipcRenderer.invoke("fetchProject", path),
    deleteRecentProject: path => ipcRenderer.invoke("deleteRecentProject", path),
    updateProjectEditedTimestamp: path => ipcRenderer.invoke("updateProjectEditedTimestamp", path),
    fetchSprites: path => ipcRenderer.invoke("fetchSprites", path),
    fetchSpriteCode: (path, name) => ipcRenderer.invoke("fetchSpriteCode", path, name),
    isProjectMissing: path => ipcRenderer.invoke("isProjectMissing", path),
    openInExplorer: path => ipcRenderer.invoke("openInExplorer", path),
    saveScriptCode: (path, name, code) => ipcRenderer.invoke("saveScriptCode", path, name, code),
    createSprite: (path, name, extension) => ipcRenderer.invoke("createSprite", path, name, extension),
    deleteSprite: (path, name) => ipcRenderer.invoke("deleteSprite", path, name),
    setSpriteProperties: (path, name, props = {}) => ipcRenderer.invoke("setSpriteProperties", path, name, props),
    setBulkSpriteProperties: (path, sprites = []) => ipcRenderer.invoke("setBulkSpriteProperties", path, sprites),
    setSpriteImage: (path, name, buffer) => ipcRenderer.invoke("setSpriteImage", path, name, buffer),
    createMissingSpriteImages: path => ipcRenderer.invoke("createMissingSpriteImages", path),
    openProjectPopup: () => ipcRenderer.invoke("openProjectPopup")
};
contextBridge.exposeInMainWorld("__bridge__", API);