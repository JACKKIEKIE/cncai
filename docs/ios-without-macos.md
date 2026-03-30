# 灵语智造 iOS 无 Mac 打包与安装

## 当前项目状态

- Web 端已经改成 iPhone 导向的液态玻璃界面。
- `ios/` 原生工程已经生成，可以直接交给云端 macOS 构建。
- 包标识为 `com.linguacnc.app`。
- App 名称为 `灵语智造`。

## 推荐路径

### 方案 A：Codemagic + TestFlight

适合长期测试，最省心。

1. 注册并加入 Apple Developer Program。
2. 在 App Store Connect 里创建 App 记录，Bundle ID 使用 `com.linguacnc.app`。
3. 在 App Store Connect 里创建 API Key。
4. 在 Codemagic 中连接仓库，并读取根目录 `codemagic.yaml`。
5. 在 Codemagic 中配置：
   - App Store Connect API Key
   - iOS signing，分发类型选 `app_store`
   - 证书与描述文件可直接从 Apple Developer Portal 抓取
6. 将 `codemagic.yaml` 中的两个占位符替换掉：
   - `REPLACE_WITH_YOUR_APP_STORE_CONNECT_KEY_NAME`
   - `REPLACE_WITH_YOUR_APPLE_ID`
7. 运行 `ios-testflight` 工作流。
8. 构建成功后，在 iPhone 上安装 TestFlight，接受测试邀请并安装应用。

### 方案 B：Codemagic + Ad Hoc IPA

适合你想拿到一个签好名的 `.ipa` 并直接装到指定 iPhone。

1. 在 Apple Developer 后台把你的 iPhone UDID 加到设备列表。
2. 在 Codemagic 中配置 `ad_hoc` 类型的证书与描述文件。
3. 运行 `ios-adhoc-install` 工作流。
4. 下载产出的 `.ipa`。
5. 安装方式二选一：
   - 上传到企业内部分发页或 OTA 分发平台，再在 iPhone 上点安装
   - 用 Windows 工具给已登记 UDID 的 iPhone 安装该 IPA

## 注意

- 没有 macOS 电脑，不等于不能做 iOS 包；但最终签名和归档仍然需要一台云端 macOS 构建机。
- 如果只是自己和团队测试，优先走 TestFlight。
- 如果一定要“拿到 IPA 文件并手动装机”，就走 Ad Hoc。
