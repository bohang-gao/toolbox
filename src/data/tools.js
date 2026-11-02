// 全站工具目录（名称/路由/图标/颜色/描述/热门 与原站一致）
export const IMG_TOOLS = [
  { name: '证件照换底色', path: '/idphoto', icon: 'fa-id-card', color: '#0081ff', desc: '一寸照制作，一键换底色', hot: false },
  { name: '图片压缩', path: '/imagecompress', icon: 'fa-compress', color: '#0081ff', desc: '不改变图片尺寸减小文件大小', hot: true },
  { name: '图片尺寸调整', path: '/imageresize', icon: 'fa-expand', color: '#0081ff', desc: '图片宽高等比缩放', hot: true },
  { name: '图片Base64编码', path: '/image2base64', icon: 'fa-file-image-o', color: '#a5673f', desc: '图片和base64编码互转', hot: false },
  { name: '二维码制作', path: '/qrcode', icon: 'fa-qrcode', color: '#333', desc: '根据文字生成二维码图片', hot: false },
  { name: '图片转PDF', path: '/image2pdf', icon: 'fa-file-image-o', color: '#e54d42', desc: '将图片转换为PDF文件', hot: true },
  { name: '图片转文字', path: '/ocr', icon: 'fa-text-width', color: '#f37b1d', desc: '提取图片中的文字', hot: false },
  { name: '图片转JPG', path: '/image2jpg', icon: 'fa-file-image-o', color: '#a5673f', desc: '将图片转换为jpg格式', hot: false },
  { name: '图片转PNG', path: '/image2png', icon: 'fa-file-image-o', color: '#a5673f', desc: '将图片转换为png格式', hot: false },
  { name: '图片转webp', path: '/image2webp', icon: 'fa-file-image-o', color: '#a5673f', desc: '将图片转换为webp格式', hot: false },
  { name: '图片旋转翻转', path: '/imagerotate', icon: 'fa-repeat', color: '#0081ff', desc: '图片旋转，图片翻转', hot: false },
  { name: '拼长图', path: '/imagecombine', icon: 'fa-bars', color: '#0081ff', desc: '水平拼接，垂直拼接', hot: false },
  { name: '拼字幕', path: '/imagesubtitle', icon: 'fa-tv', color: '#0081ff', desc: '图片拼字幕，拼台词', hot: false },
  { name: '图片编辑器', path: '/image-editor', icon: 'fa-edit', color: '#0081ff', desc: '支持裁剪|调色|添加文字|滤镜', hot: false },
  { name: '宫格拼图', path: '/image-grid', icon: 'fa-th-large', color: '#0081ff', desc: '网格拼图，模板拼图', hot: true },
  { name: '图片分割', path: '/imagesplit', icon: 'fa-th', color: '#0081ff', desc: '宫格切图，网格切图', hot: false },
  { name: '图片加水印', path: '/image-watermark', icon: 'fa-pencil', color: '#0081ff', desc: '图片批量添加水印', hot: false }
]

export const PDF_TOOLS = [
  { name: 'PDF合并', path: '/pdfmerge', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '将多个PDF文件合并成一个文件', hot: true },
  { name: 'PDF拆分', path: '/pdfsplit', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '将一个PDF文件拆分成多个文件', hot: true },
  { name: 'PDF提取页面', path: '/pdfextract', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '从一个PDF文件中提取若干页面', hot: false },
  { name: 'PDF删除页面', path: '/pdfdelete', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '从一个PDF文件中删除若干页面', hot: false },
  { name: 'Word转PDF', path: '/word2pdf', icon: 'fa-file-word-o', color: '#0081ff', desc: '将Word文件转换为PDF文件', hot: false },
  { name: 'Excel转PDF', path: '/excel2pdf', icon: 'fa-file-excel-o', color: '#39b54a', desc: '将Excel文件转换为PDF文件', hot: false },
  { name: 'PPT转PDF', path: '/ppt2pdf', icon: 'fa-file-powerpoint-o', color: '#f37b1d', desc: '将PPT文件转换为PDF文件', hot: false },
  { name: 'PDF转Word', path: '/pdf2word', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '将PDF文件转换为Word文件', hot: false },
  { name: 'PDF转图片', path: '/pdf2image', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '提取PDF页面为图片', hot: true },
  { name: 'PDF旋转', path: '/pdfrotate', icon: 'fa-repeat', color: '#e54d42', desc: '批量旋转PDF页面', hot: false },
  { name: 'PDF排序', path: '/pdfsort', icon: 'fa-sort-alpha-asc', color: '#e54d42', desc: 'PDF页面排序', hot: true },
  { name: 'PDF压缩', path: '/pdfcompress', icon: 'fa-compress', color: '#e54d42', desc: '压缩PDF文件减小体积', hot: false },
  { name: 'PDF加页码', path: '/pdf-page-number', icon: 'fa-sort-numeric-asc', color: '#e54d42', desc: '支持多种位置添加页码', hot: false },
  { name: 'PDF加水印', path: '/pdf-watermark', icon: 'fa-pencil', color: '#e54d42', desc: '添加文字或图片水印', hot: false },
  { name: 'PDF修改元数据', path: '/pdf-metadata', icon: 'fa-info', color: '#aaa', desc: '修改标题|作者|时间等', hot: false },
  { name: 'PDF页面调整', path: '/pdf-resize', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '统一PDF页面宽度', hot: false },
  { name: 'PDF转长图', path: '/pdf-to-long-image', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '将PDF转为长长的图片', hot: false },
  { name: 'PDF提取图片', path: '/pdf-extract-image', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '从PDF文件中提取所有图片', hot: false },
  { name: 'PDF去水印', path: '/pdf-remove-watermark', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '去除PDF文件中的水印', hot: false },
  { name: 'PDF编辑器', path: '/pdf-editor', icon: 'fa-pencil-square-o', color: '#e54d42', desc: '本地编辑PDF可添加文字、图片和签名', hot: true }
]

export const MORE_TOOLS = [
  { name: 'Unix时间戳', path: '/timestamp', icon: 'fa-clock-o', color: '#8799a3', desc: '在线时间戳转换', hot: false },
  { name: '颜色值转换', path: '/color', icon: 'fa-leaf', color: '#e54d42', desc: 'RGB转HEX,RGBA,HSL', hot: false },
  { name: 'Base64编码解码', path: '/base64', icon: 'fa-code', color: '#8dc63f', desc: 'base64编码，base64解码', hot: false },
  { name: 'URL编码解码', path: '/url', icon: 'fa-code', color: '#39b54a', desc: 'url编码，url解码', hot: false },
  { name: 'Unicode编码转换', path: '/unicode', icon: 'fa-code', color: '#1cbbb4', desc: 'unicode转中文，中文转unicode', hot: false },
  { name: '进制转换', path: '/number', icon: 'fa-angle-double-right', color: '#0081ff', desc: '二、四、八、十、十六、三十二进制互转', hot: false },
  { name: '正则表达式测试', path: '/regex', icon: 'fa-check-square-o', color: '#e54d42', desc: '在线正则测试工具', hot: false },
  { name: 'AES加密解密', path: '/aes', icon: 'fa-user-secret', color: '#8dc63f', desc: '在线AES加密、AES解密工具', hot: false },
  { name: 'DES加密解密', path: '/des', icon: 'fa-user-secret', color: '#39b54a', desc: '在线DES加密、DES解密工具', hot: false },
  { name: 'RSA加密解密', path: '/rsa', icon: 'fa-user-secret', color: '#1cbbb4', desc: '在线RSA加密、RSA解密工具', hot: false },
  { name: 'Hash计算', path: '/hash', icon: 'fa-calculator', color: '#0081ff', desc: '在线Hash计算工具', hot: false },
  { name: '文件Hash计算', path: '/file_hash', icon: 'fa-calculator', color: '#6739b6', desc: '在线文件Hash值计算工具', hot: false },
  { name: 'WebSocket测试', path: '/websocket', icon: 'fa-connectdevelop', color: '#9c26b0', desc: '在线WebSocket测试工具', hot: false },
  { name: '摩斯电码', path: '/morse', icon: 'fa-phone-square', color: '#a5673f', desc: '摩斯电码编码，摩斯电码解码', hot: false }
]

export const ALL_SECTIONS = [
  { title: '图片工具', tools: IMG_TOOLS },
  { title: '文档工具', tools: PDF_TOOLS },
  { title: '其他工具', tools: MORE_TOOLS }
]

export const ALL_TOOLS = ALL_SECTIONS.flatMap(s => s.tools)

export const toolIconClass = (t) => `fa ${t.icon}`
