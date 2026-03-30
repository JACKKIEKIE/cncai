import UIKit
import Capacitor
import SwiftUI
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        DispatchQueue.main.async {
            self.window?.backgroundColor = UIColor(red: 0.93, green: 0.96, blue: 1.0, alpha: 1.0)
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}

    func applicationDidEnterBackground(_ application: UIApplication) {}

    func applicationWillEnterForeground(_ application: UIApplication) {}

    func applicationDidBecomeActive(_ application: UIApplication) {}

    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

final class NativeShellBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private let shellModel = NativeShellModel()
    private let shouldUseNativeShell = UIDevice.current.userInterfaceIdiom == .phone
    private var topChromeController: UIHostingController<NativeShellTopBarView>?
    private var bottomChromeController: UIHostingController<NativeShellTabBarView>?

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard shouldUseNativeShell else {
            dispatchWebEvent(name: "linguacnc:native-shell-availability", detail: ["enabled": false], shellEnabled: false)
            return
        }
        configureNativeShellBridge()
        installNativeShellChromeIfNeeded()
        dispatchWebEvent(name: "linguacnc:native-shell-availability", detail: ["enabled": true], shellEnabled: true)
    }

    deinit {
        bridge?.webView?.configuration.userContentController.removeScriptMessageHandler(forName: "linguacncShell")
    }

    private func configureNativeShellBridge() {
        guard let webView = bridge?.webView else {
            return
        }

        webView.backgroundColor = .clear
        webView.isOpaque = false
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "linguacncShell")
        webView.configuration.userContentController.add(self, name: "linguacncShell")
    }

    private func installNativeShellChromeIfNeeded() {
        guard topChromeController == nil, bottomChromeController == nil else {
            return
        }

        view.backgroundColor = UIColor(red: 0.93, green: 0.96, blue: 1.0, alpha: 1.0)

        let topController = UIHostingController(
            rootView: NativeShellTopBarView(
                model: shellModel,
                onOpenHistory: { [weak self] in
                    self?.dispatchWebEvent(name: "linguacnc:open-history")
                },
                onOpenAbout: { [weak self] in
                    self?.dispatchWebEvent(name: "linguacnc:open-about")
                }
            )
        )
        topController.view.backgroundColor = .clear
        topController.view.translatesAutoresizingMaskIntoConstraints = false
        addChild(topController)
        view.addSubview(topController.view)
        topController.didMove(toParent: self)

        let bottomController = UIHostingController(
            rootView: NativeShellTabBarView(
                model: shellModel,
                onSelect: { [weak self] selectedView in
                    self?.shellModel.selectedView = selectedView
                    self?.dispatchWebEvent(name: "linguacnc:navigate", detail: ["view": selectedView.rawValue])
                }
            )
        )
        bottomController.view.backgroundColor = .clear
        bottomController.view.translatesAutoresizingMaskIntoConstraints = false
        addChild(bottomController)
        view.addSubview(bottomController.view)
        bottomController.didMove(toParent: self)

        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            topController.view.topAnchor.constraint(equalTo: guide.topAnchor, constant: 6),
            topController.view.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
            topController.view.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -12),
            topController.view.heightAnchor.constraint(equalToConstant: 62),

            bottomController.view.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 12),
            bottomController.view.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -12),
            bottomController.view.bottomAnchor.constraint(equalTo: guide.bottomAnchor, constant: -10),
            bottomController.view.heightAnchor.constraint(equalToConstant: 94)
        ])

        view.bringSubviewToFront(topController.view)
        view.bringSubviewToFront(bottomController.view)

        topChromeController = topController
        bottomChromeController = bottomController
    }

    private func dispatchWebEvent(name: String, detail: [String: Any] = [:], shellEnabled: Bool = true) {
        guard let webView = bridge?.webView else {
            return
        }

        let jsonData = (try? JSONSerialization.data(withJSONObject: detail, options: [])) ?? Data("{}".utf8)
        let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
        let runtimeStateScript = shellEnabled
            ? """
            window.__LINGUACNC_NATIVE_SHELL__ = true;
            document.documentElement.dataset.nativeShell = 'ios';
            document.body.dataset.nativeShell = 'ios';
            """
            : """
            window.__LINGUACNC_NATIVE_SHELL__ = false;
            delete document.documentElement.dataset.nativeShell;
            delete document.body.dataset.nativeShell;
            """
        let script = """
        \(runtimeStateScript)
        window.dispatchEvent(new CustomEvent('\(name)', { detail: \(jsonString) }));
        """
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "linguacncShell",
              let body = message.body as? [String: Any],
              let type = body["type"] as? String
        else {
            return
        }

        switch type {
        case "viewChange":
            if let viewName = body["view"] as? String, let selectedView = NativeShellViewKind(rawValue: viewName) {
                shellModel.selectedView = selectedView
            }
            if let hasConversation = body["hasConversation"] as? Bool {
                shellModel.hasConversation = hasConversation
            }
        default:
            break
        }
    }
}

private final class NativeShellModel: ObservableObject {
    @Published var selectedView: NativeShellViewKind = .task
    @Published var hasConversation = false
}

private enum NativeShellViewKind: String, CaseIterable {
    case task
    case sim
    case code
    case setup

    var title: String {
        switch self {
        case .task:
            return "Chat"
        case .sim:
            return "Sim"
        case .code:
            return "Code"
        case .setup:
            return "Setup"
        }
    }

    var subtitle: String {
        switch self {
        case .task:
            return "AI CNC workspace"
        case .sim:
            return "Toolpath and stock preview"
        case .code:
            return "Review generated output"
        case .setup:
            return "Material and process summary"
        }
    }

    var symbolName: String {
        switch self {
        case .task:
            return "ellipsis.message.fill"
        case .sim:
            return "cube.transparent.fill"
        case .code:
            return "chevron.left.forwardslash.chevron.right"
        case .setup:
            return "list.bullet.clipboard.fill"
        }
    }
}

private struct NativeShellTopBarView: View {
    @ObservedObject var model: NativeShellModel
    let onOpenHistory: () -> Void
    let onOpenAbout: () -> Void

    var body: some View {
        NativeGlassBar {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("LinguaCNC")
                        .font(.system(size: 18, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color(red: 0.06, green: 0.09, blue: 0.16))
                    Text(model.selectedView.subtitle)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundStyle(Color(red: 0.39, green: 0.47, blue: 0.60))
                        .lineLimit(1)
                }

                Spacer(minLength: 12)

                HStack(spacing: 8) {
                    NativeChromeIconButton(systemName: "clock.arrow.circlepath", action: onOpenHistory)
                    NativeChromeIconButton(systemName: "info.circle", action: onOpenAbout)
                }
            }
        }
    }
}

private struct NativeShellTabBarView: View {
    @ObservedObject var model: NativeShellModel
    let onSelect: (NativeShellViewKind) -> Void

    var body: some View {
        NativeGlassBar(padding: EdgeInsets(top: 10, leading: 10, bottom: 12, trailing: 10)) {
            HStack(spacing: 8) {
                ForEach(NativeShellViewKind.allCases, id: \.rawValue) { item in
                    Button(action: { onSelect(item) }) {
                        VStack(spacing: 6) {
                            Image(systemName: item.symbolName)
                                .font(.system(size: 16, weight: .semibold))
                            Text(item.title)
                                .font(.system(size: 11, weight: .semibold, design: .rounded))
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .foregroundStyle(model.selectedView == item ? Color.white : Color(red: 0.30, green: 0.37, blue: 0.49))
                        .background(tabBackground(for: item))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @ViewBuilder
    private func tabBackground(for item: NativeShellViewKind) -> some View {
        if model.selectedView == item {
            if #available(iOS 26.0, *) {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color(red: 0.04, green: 0.52, blue: 1.0))
                    .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 20))
            } else {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Color(red: 0.04, green: 0.52, blue: 1.0), Color(red: 0.20, green: 0.40, blue: 0.95)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            }
        } else {
            Color.clear
        }
    }
}

private struct NativeChromeIconButton: View {
    let systemName: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 15, weight: .semibold))
                .frame(width: 34, height: 34)
                .foregroundStyle(Color(red: 0.18, green: 0.23, blue: 0.31))
                .background(iconBackground)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var iconBackground: some View {
        if #available(iOS 26.0, *) {
            Circle()
                .fill(Color.white.opacity(0.18))
                .glassEffect(.regular.interactive(), in: .circle)
        } else {
            Circle()
                .fill(.ultraThinMaterial)
                .overlay(Circle().stroke(Color.white.opacity(0.28), lineWidth: 1))
        }
    }
}

private struct NativeGlassBar<Content: View>: View {
    private let padding: EdgeInsets
    private let content: Content

    init(padding: EdgeInsets = EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16), @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        Group {
            if #available(iOS 26.0, *) {
                content
                    .padding(padding)
                    .glassEffect(.regular, in: .capsule)
            } else {
                content
                    .padding(padding)
                    .background(.ultraThinMaterial, in: Capsule(style: .continuous))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(Color.white.opacity(0.32), lineWidth: 1)
                    )
                    .shadow(color: Color.black.opacity(0.08), radius: 18, y: 10)
            }
        }
    }
}
