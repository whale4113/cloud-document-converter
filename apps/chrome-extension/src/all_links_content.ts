import { Flag } from './common/message';



export const injectReferencesButton = () => {
  // 检查是否已经存在按钮，避免重复注入
  if (document.querySelector('#references-button')) {
    return;
  }

  const button = document.createElement('button');
  button.id = 'references-button';
  button.innerHTML = `
    <span style="margin-right: 4px;">📑</span>
    查看引用
  `;
  
  button.style.cssText = `
    position: fixed;
    right: 20px;
    bottom: 80px;
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
    console.log("content-cmd")
    chrome.runtime.sendMessage({ flag: 'parse_docx_references' });
  };

  document.body.appendChild(button);
};
