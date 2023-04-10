const downRoleController = new AbortController();
setTimeout(() => {
  downRoleController.abort();
}, 10000);
const preEle = document.getElementById("preSetSystem");
fetch(
  "https://cdn.jsdelivr.net/gh/PlexPt/awesome-chatgpt-prompts-zh/prompts-zh.json",
  {
    signal: downRoleController.signal,
  }
)
  .then(async (response) => {
    let res = await response.json();
    for (let i = 0; i < res.length; i++) {
      let key = "act" + i;
      presetRoleData[key] = res[i].prompt.trim();
      let optionEle = document.createElement("option");
      optionEle.text = res[i].act;
      optionEle.value = key;
      preEle.options.add(optionEle);
    }
  })
  .catch((e) => {
    console.error(e);
    // 请求失败，尝试使用本地文件
    fetch("prompts-zh.json")
      .then(async (response) => {
        let res = await response.json();
        for (let i = 0; i < res.length; i++) {
          let key = "act" + i;
          presetRoleData[key] = res[i].prompt.trim();
          let optionEle = document.createElement("option");
          optionEle.text = res[i].act;
          optionEle.value = key;
          preEle.options.add(optionEle);
        }
      })
      .catch((e) => {
        console.error(e);
        // 本地文件也无法读取，进行错误处理
      });
  });
