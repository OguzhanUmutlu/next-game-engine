const pNameDiv = document.getElementById("project-name");
const pPathDiv = document.getElementById("project-path");

window.createProject = async () => {
    const name = pNameDiv.value;
    const path = pPathDiv.value;
    if (!name || !/^[a-zA-Z\d_ ()]+$/.test(name)) {
        setPopupText("Expected a valid project name.");
        showPopup();
        return;
    }
    await __bridge__.createProject(name, path);
    redirectTo("project", "?path=" + encodeURI(path));
};

const p = (await __bridge__.getDefaultProjectPath()).replaceAll("\\", "/");

pPathDiv.value = p + "/";

let lastN = "";
setInterval(() => {
    if (lastN === pNameDiv.value) return;
    pNameDiv.value = pNameDiv.value.replaceAll(/[^a-zA-Z\d _]/g, "");
    lastN = pNameDiv.value;
    pPathDiv.value = p + "/" + lastN;
});