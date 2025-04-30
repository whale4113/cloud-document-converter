export const injectDownloadButton = () => {
  // 检查是否已经存在按钮，避免重复注入
  if (document.querySelector('#download-md-button')) {
    return;
  }

  const button = document.createElement('button');
  button.id = 'download-md-button';
  button.innerHTML = `
    <span style="margin-right: 4px;">⬇️</span>
    Download MD
  `;
  
  button.style.cssText = `
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 9999;
    padding: 8px 16px;
    background-color: #3370ff;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    font-size: 14px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: all 0.2s;
  `;

  button.onmouseenter = () => {
    button.style.backgroundColor = '#2860e0';
  };
  button.onmouseleave = () => {
    button.style.backgroundColor = '#3370ff';
  };

  button.onclick = () => {
    chrome.runtime.sendMessage({ flag: 'download_docx_as_markdown' });
  };

  document.body.appendChild(button);
};