type Project = {
    name: string,
    path: string,
    editedTimestamp: number
};

type MissingProject = {
    name: string,
    path: string,
    editedTimestamp: null,
    missing: true
};

type Sprite = {
    name: string,
    x: number,
    y: number,
    z: number,
    visible: boolean,
    file: string,
    createdTimestamp: number
};

type Bridge = {
    getRecentProjects(): Promise<(Project | MissingProject)[]>
    createProject(name: string, path: string): Promise<string>
    getDefaultProjectPath(): Promise<string>
    fetchProject(path: string): Promise<Project | MissingProject>
    deleteRecentProject(path: string): Promise<void>
    updateProjectEditedTimestamp(path: string): Promise<void>
    fetchSprites(path: string): Promise<Sprite[]>
    fetchSpriteCode(path: string, name: string): Promise<string | null>
    isProjectMissing(path: string): Promise<boolean>
    openInExplorer(path: string): Promise<void>
    saveScriptCode(path: string, name: string, code: string): Promise<void>
    createSprite(path: string, name: string, extension: string): Promise<void>
    deleteSprite(path: string, name: string): Promise<void>
    setSpriteProperties(path: string, name: string, props: Partial<Sprite>): Promise<void>
    setBulkSpriteProperties(path: string, sprites: Partial<Sprite>[]): Promise<void>
    setSpriteImage(path: string, name: string, buffer: Int8Array): Promise<void>
    createMissingSpriteImages(path: string): Promise<void>
    openProjectPopup(): Promise<void>
};

// @ts-ignore
declare global {
    let __bridge__: Bridge;
}