const projectsDiv = document.querySelector(".projects");

async function refreshProjects() {
    const projects = await __bridge__.getRecentProjects();
    const sorted = projects.sort((a, b) => b.editedTimestamp - a.editedTimestamp);
    projectsDiv.innerHTML = "";
    for (const p of sorted) {
        const div = document.createElement("div");
        div.classList.add("project");
        if (p.missing) div.classList.add("missing-project");
        div.innerHTML = `<div class="name">${p.name}</div>
<div class="edit-date">Last edited at: ${formatTime(p.editedTimestamp)}</div>`;
        if (!p.missing) {
            const deleteButton = document.createElement("div");
            deleteButton.classList.add("project-delete");
            deleteButton.innerHTML = "<img src='../../assets/delete.png'>";
            deleteButton.addEventListener("click", () => {
                setPopupText("Do you really want to remove the project called '" + p.name + "' from the recent projects list?", [
                    ["Cancel", hidePopup],
                    ["Yes", async () => {
                        await __bridge__.deleteRecentProject(p.path);
                        await refreshProjects();
                        hidePopup();
                    }, "#25e025"]
                ]);
                showPopup();
            });
            div.appendChild(deleteButton);
        }
        div.addEventListener("click", e => {
            if (p.missing) {
                setPopupText("The project files are missing, do you wish to remove it from your recently viewed projects?", [
                    ["Cancel", hidePopup],
                    ["Delete", async () => {
                        await __bridge__.deleteRecentProject(p.path);
                        await refreshProjects();
                        hidePopup();
                    }, "#ff4242"]
                ])
                showPopup();
                return;
            }
            if (e.target !== div) return;
            redirectTo("project", "?path=" + encodeURI(p.path));
        });
        projectsDiv.appendChild(div);
    }
}

await refreshProjects();

window.createProjectPopup = async () => {
    setPopupText("<input type='text' placeholder='Project name...' id='project-name' spellcheck='false'><br>" +
        "<input type='text' placeholder='Project path...' id='project-path' spellcheck='false'>", [
        ["Cancel", () => {
            hidePopup();
            clearInterval(interval);
        }],
        ["Create", async () => {
            const name = nameDiv.value;
            const path = pathDiv.value;
            if (name.length <= 0 || name.length >= 64 || !VALID_NAME_REGEXP.test(name)) {
                setPopupText("Invalid project name.<br>Regexp: " + VALID_NAME_REGEXP.toString());
                return;
            }
            await __bridge__.createProject(name, path);
            redirectTo("project", "?path=" + encodeURI(path));
            hidePopup();
            clearInterval(interval);
        }, "#25e025"]
    ]);
    showPopup();
    const nameDiv = document.getElementById("project-name");
    const pathDiv = document.getElementById("project-path");

    const p = (await __bridge__.getDefaultProjectPath()).replaceAll("\\", "/");

    let lastN = "";
    let interval = setInterval(() => {
        if (lastN === nameDiv.value) return;
        nameDiv.value = nameDiv.value.replaceAll(INVALID_NAME_REGEXP, "");
        lastN = nameDiv.value;
        pathDiv.value = p + "/" + lastN;
    });

    pathDiv.value = p + "/";
};

window.settingsPopup = async () => {
    setPopupText("<label><input type='checkbox' data-opt='pageTransition' data-opt-attr='checked' spellCheck='false'> Page transition</label><br>" +
        "<label><input type='checkbox' data-opt='globalTransition' data-opt-attr='checked' spellCheck='false'> Global transition</label><br>" +
        "<label><input type='checkbox' data-opt='monacoEditor' data-opt-attr='checked' spellCheck='false'> Monaco Editor</label><br>", [
        ["Cancel", hidePopup],
        ["Save settings", async () => {
            document.querySelectorAll("[data-opt]").forEach(i => {
                engineSettings[i.getAttribute("data-opt")] = i[i.getAttribute("data-opt-attr") ?? "value"];
            });
            saveEngineSettings();
            setPopupText("Successfully saved settings!");
        }, "#25e025"]
    ]);
    showPopup();
    document.querySelectorAll("[data-opt]").forEach(i => {
        i[i.getAttribute("data-opt-attr") ?? "value"] = engineSettings[i.getAttribute("data-opt")];
    });
};

window.openProjectPopup = async () => {
    await __bridge__.openProjectPopup();
    await refreshProjects();
};

addEventListener("focus", refreshProjects);