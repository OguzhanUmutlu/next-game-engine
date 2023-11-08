(async () => {
    await import("https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js");
    const pyd = await loadPyodide({
        stdout: (...a) => postMessage({stdout: a})
    });
    postMessage("im loaded");

    onmessage = ({data}) => {
        const ran = pyd.runPython(data.code);
        //console.log(pyd, ran, pyd.globals.get("update"));
        postMessage({id: data.id, result: ran});
    };
})();