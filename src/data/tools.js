// 全站工具目录（名称/路由/图标/颜色/描述 与原站一致）
export const IMG_TOOLS = [
  { name: '证件照换底色', path: '/idphoto', icon: 'fa-id-card', color: '#0081ff', desc: '一寸照制作，一键换底色' },
  { name: '图片压缩', path: '/imagecompress', icon: 'fa-compress', color: '#0081ff', desc: '不改变图片尺寸减小文件大小' },
  { name: '图片尺寸调整', path: '/imageresize', icon: 'fa-expand', color: '#0081ff', desc: '图片宽高等比缩放' },
  { name: '图片Base64编码', path: '/image2base64', icon: 'fa-file-image-o', color: '#a5673f', desc: '图片和base64编码互转' },
  { name: '二维码制作', path: '/qrcode', icon: 'fa-qrcode', color: '#333', desc: '根据文字生成二维码图片' },
  { name: '图片转PDF', path: '/image2pdf', icon: 'fa-file-image-o', color: '#e54d42', desc: '将图片转换为PDF文件' },
  { name: '图片转文字', path: '/ocr', icon: 'fa-text-width', color: '#f37b1d', desc: '提取图片中的文字' },
  { name: '图片转JPG', path: '/image2jpg', icon: 'fa-file-image-o', color: '#a5673f', desc: '将图片转换为jpg格式' },
  { name: '图片转PNG', path: '/image2png', icon: 'fa-file-image-o', color: '#a5673f', desc: '将图片转换为png格式' },
  { name: '图片转webp', path: '/image2webp', icon: 'fa-file-image-o', color: '#a5673f', desc: '将图片转换为webp格式' },
  { name: '图片旋转翻转', path: '/imagerotate', icon: 'fa-repeat', color: '#0081ff', desc: '图片旋转，图片翻转' },
  { name: '拼长图', path: '/imagecombine', icon: 'fa-bars', color: '#0081ff', desc: '水平拼接，垂直拼接' },
  { name: '拼字幕', path: '/imagesubtitle', icon: 'fa-tv', color: '#0081ff', desc: '图片拼字幕，拼台词' },
  { name: '图片编辑器', path: '/image-editor', icon: 'fa-edit', color: '#0081ff', desc: '支持裁剪|调色|添加文字|滤镜' },
  { name: '宫格拼图', path: '/image-grid', icon: 'fa-th-large', color: '#0081ff', desc: '网格拼图，模板拼图' },
  { name: '图片分割', path: '/imagesplit', icon: 'fa-th', color: '#0081ff', desc: '宫格切图，网格切图' },
  { name: '图片加水印', path: '/image-watermark', icon: 'fa-pencil', color: '#0081ff', desc: '图片批量添加水印' }
]

export const PDF_TOOLS = [
  { name: '批量打印', path: '/print', icon: 'fa-print', color: '#e54d42', desc: '多文件一次打印，支持 PDF 与图片' },
  { name: 'PDF合并', path: '/pdfmerge', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '将多个PDF文件合并成一个文件' },
  { name: 'PDF拆分', path: '/pdfsplit', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '将一个PDF文件拆分成多个文件' },
  { name: 'PDF提取页面', path: '/pdfextract', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '从一个PDF文件中提取若干页面' },
  { name: 'PDF删除页面', path: '/pdfdelete', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '从一个PDF文件中删除若干页面' },
  { name: 'Word转PDF', path: '/word2pdf', icon: 'fa-file-word-o', color: '#0081ff', desc: '将Word文件转换为PDF文件' },
  { name: 'Excel转PDF', path: '/excel2pdf', icon: 'fa-file-excel-o', color: '#39b54a', desc: '将Excel文件转换为PDF文件' },
  { name: 'PPT转PDF', path: '/ppt2pdf', icon: 'fa-file-powerpoint-o', color: '#f37b1d', desc: '将PPT文件转换为PDF文件' },
  { name: 'PDF转Word', path: '/pdf2word', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '将PDF文件转换为Word文件' },
  { name: 'PDF转图片', path: '/pdf2image', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '提取PDF页面为图片' },
  { name: 'PDF旋转', path: '/pdfrotate', icon: 'fa-repeat', color: '#e54d42', desc: '批量旋转PDF页面' },
  { name: 'PDF排序', path: '/pdfsort', icon: 'fa-sort-alpha-asc', color: '#e54d42', desc: 'PDF页面排序' },
  { name: 'PDF压缩', path: '/pdfcompress', icon: 'fa-compress', color: '#e54d42', desc: '压缩PDF文件减小体积' },
  { name: 'PDF加页码', path: '/pdf-page-number', icon: 'fa-sort-numeric-asc', color: '#e54d42', desc: '支持多种位置添加页码' },
  { name: 'PDF加水印', path: '/pdf-watermark', icon: 'fa-pencil', color: '#e54d42', desc: '添加文字或图片水印' },
  { name: 'PDF修改元数据', path: '/pdf-metadata', icon: 'fa-info', color: '#aaa', desc: '修改标题|作者|时间等' },
  { name: 'PDF页面调整', path: '/pdf-resize', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '统一PDF页面宽度' },
  { name: 'PDF转长图', path: '/pdf-to-long-image', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '将PDF转为长长的图片' },
  { name: 'PDF提取图片', path: '/pdf-extract-image', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '从PDF文件中提取所有图片' },
  { name: 'PDF去水印', path: '/pdf-remove-watermark', icon: 'fa-file-pdf-o', color: '#e54d42', desc: '去除PDF文件中的水印' },
  { name: 'PDF编辑器', path: '/pdf-editor', icon: 'fa-pencil-square-o', color: '#e54d42', desc: '本地编辑PDF可添加文字、图片和签名' }
]

export const MORE_TOOLS = [
  { name: 'Unix时间戳', path: '/timestamp', icon: 'fa-clock-o', color: '#8799a3', desc: '在线时间戳转换' },
  { name: '颜色值转换', path: '/color', icon: 'fa-leaf', color: '#e54d42', desc: 'RGB转HEX,RGBA,HSL' },
  { name: 'Base64编码解码', path: '/base64', icon: 'fa-code', color: '#8dc63f', desc: 'base64编码，base64解码' },
  { name: 'URL编码解码', path: '/url', icon: 'fa-code', color: '#39b54a', desc: 'url编码，url解码' },
  { name: 'Unicode编码转换', path: '/unicode', icon: 'fa-code', color: '#1cbbb4', desc: 'unicode转中文，中文转unicode' },
  { name: '进制转换', path: '/number', icon: 'fa-angle-double-right', color: '#0081ff', desc: '二、四、八、十、十六、三十二进制互转' },
  { name: '正则表达式测试', path: '/regex', icon: 'fa-check-square-o', color: '#e54d42', desc: '在线正则测试工具' },
  { name: 'AES加密解密', path: '/aes', icon: 'fa-user-secret', color: '#8dc63f', desc: '在线AES加密、AES解密工具' },
  { name: 'DES加密解密', path: '/des', icon: 'fa-user-secret', color: '#39b54a', desc: '在线DES加密、DES解密工具' },
  { name: 'RSA加密解密', path: '/rsa', icon: 'fa-user-secret', color: '#1cbbb4', desc: '在线RSA加密、RSA解密工具' },
  { name: 'Hash计算', path: '/hash', icon: 'fa-calculator', color: '#0081ff', desc: '在线Hash计算工具' },
  { name: '文件Hash计算', path: '/file_hash', icon: 'fa-calculator', color: '#6739b6', desc: '在线文件Hash值计算工具' },
  { name: 'WebSocket测试', path: '/websocket', icon: 'fa-connectdevelop', color: '#9c26b0', desc: '在线WebSocket测试工具' },
  { name: '摩斯电码', path: '/morse', icon: 'fa-phone-square', color: '#a5673f', desc: '摩斯电码编码，摩斯电码解码' }
]

export const ALL_SECTIONS = [
  { title: '图片工具', tools: IMG_TOOLS },
  { title: '文档工具', tools: PDF_TOOLS },
  { title: '其他工具', tools: MORE_TOOLS }
]

export const ALL_TOOLS = ALL_SECTIONS.flatMap(s => s.tools)

export const toolIconClass = (t) => `fa ${t.icon}`
