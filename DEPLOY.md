# 部署与分享

游戏是纯静态网页（HTML + CSS + JavaScript），没有后端，也不需要数据库；存档和成就保存在玩家自己的浏览器里。所以只要把文件放到任意一个静态网页托管服务上，就能得到一个公开网址。

## 当前 GitHub Pages 发布流程

- 仓库：<https://github.com/THRIDX/ainoid>
- 游戏：<https://thridx.github.io/ainoid/>
- 英文直达：<https://thridx.github.io/ainoid/?lang=en>；中文直达：<https://thridx.github.io/ainoid/?lang=zh>
- 自动发布工作流：`.github/workflows/pages.yml`

修改游戏后，先本地试玩，再提交并推送：

```bash
git add assets index.html README.md DEPLOY.md tools .github .gitignore .gitattributes
git commit -m "Update game"
git push origin main
```

在仓库的 **Actions** 查看发布结果。工作流会检查 JavaScript 语法、运行逻辑回归、生成 `dist/web`，然后发布到原网址。失败的检查不会覆盖线上版本。`dist` 是生成物，不需要提交；本机配置、备份和截图也不会上传。网站只发布运行文件与第三方地图数据许可。

## 第一步：生成发布包

```bash
node tools/build-dist.mjs
```

会生成三样东西：

| 文件 | 用途 |
|---|---|
| `dist/web/` | 静态网站目录，`index.html` 在根目录。上传到任何静态托管服务 |
| `dist/ainoid-web.zip` | 上面目录的压缩包，适合“拖进去上传”的平台 |
| `dist/ainoid.html` | 单文件版（包含中英文文本），样式和脚本全部内联，离线也能玩 |

每次改完游戏重新运行一次即可。

## 第二步：选一种方式

### A. 最快：直接发单文件

把 `dist/ainoid.html` 通过微信、QQ、邮件发给朋友，用电脑或安卓手机的浏览器打开就能玩。

- 微信、QQ 里点开文件时，请选择「用其他应用打开 → 浏览器」；内置预览可能不运行脚本。
- iPhone 的「文件」预览不运行网页脚本，iPhone 用户请用下面的网址方式。

### B. 公开网址（推荐）

以下服务都有免费额度，上传后会给一个 `https://` 网址，手机电脑都能直接打开：

1. **Netlify**：登录后打开 <https://app.netlify.com/drop>，把 `dist/web` 文件夹拖进去，得到 `https://xxx.netlify.app`。需要一个免费账号，站点才会长期保留。
2. **Cloudflare Pages**：控制台 → Workers & Pages → 创建 → Pages → 上传资产，选择 `dist/web` 文件夹或 zip，得到 `https://xxx.pages.dev`。
3. **GitHub Pages**：新建一个仓库，把 `dist/web` 里的所有文件上传到仓库根目录，然后在 Settings → Pages 里选择从 `main` 分支的根目录发布，得到 `https://用户名.github.io/仓库名/`。
4. **itch.io**（游戏玩家社区）：新建项目，类型选 HTML，上传 `dist/ainoid-web.zip`，勾选「This file will be played in the browser」。适合在游戏社区里传播。

国内访问提示：不能仅凭托管平台的「全球 CDN」宣传认定国内可用。默认域名的可达性必须部署后用国内电信、联通、移动及海外节点实测，再用手机浏览器确认游戏资源和交互；单次 HTTP 成功也不等于长期稳定。

Netlify Drop 未登录上传的站点仅保留一小时，并有临时密码；必须在期限内登录并认领才能长期保留。认领可使用免费方案，实际额度以控制台为准。[官方说明](https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/)

Cloudflare 免费 Pages 不包含中国大陆网络服务；China Network 是企业套餐的独立订阅。[官方说明](https://developers.cloudflare.com/china-network/)

EdgeOne 默认域名在中国大陆需要使用有效期为 3 小时的预览链接，适合临时测试；长期分享应评估自定义域名。[官方说明](https://pages.edgeone.ai/document/domain-overview)

### C. 面向国内玩家

想让国内玩家访问更快，可以用国内云厂商的对象存储静态网站托管（例如腾讯云 COS、阿里云 OSS）并开启 CDN。上传方式同样是把 `dist/web` 里的文件原样放进存储桶根目录。注意：使用国内节点并绑定自己的域名，需要先完成 ICP 备案；没有备案时可以选香港等境外节点。

### D. 局域网试玩

电脑和手机连同一个 Wi-Fi，运行：

```bash
python tools/serve.py --lan
```

用手机浏览器打开终端里显示的地址即可。

### E. claude.ai 页面

游戏已经发布为 claude.ai 页面。可以在页面的 Share（分享）菜单里开启分享；对方需要能访问 claude.ai。页面里浏览器会禁止直接下载文件，所以「保存海报」会弹出大图，由玩家右键或长按保存。

## 部署之后

- 海报页脚和「复制战绩」的文案会自动带上游戏网址（只在 `http/https` 的正式网址下生效，本机调试和单文件版不显示）。
- 在独立网址下，手机上的「分享」按钮会调用系统分享面板，直接把战绩海报发给朋友。
- 声音需要玩家点一下「开始觉醒」后才会播放，这是浏览器的规定。
