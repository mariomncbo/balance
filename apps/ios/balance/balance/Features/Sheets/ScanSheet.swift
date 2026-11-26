import PhotosUI
import SwiftUI
import Supabase
import UIKit

/// Escaneo de tickets: se hace una foto o se elige una de la galería (o una captura) y la IA lee el gasto.
/// Lo leído no se guarda solo: se abre el formulario ya relleno para revisarlo y confirmar.
struct ScanSheet: View {
    @Environment(AppModel.self) private var app
    @State private var picked: PhotosPickerItem?
    @State private var showCamera = false
    @State private var busy = false
    @State private var error: String?

    private var cameraAvailable: Bool { UIImagePickerController.isSourceTypeAvailable(.camera) }

    var body: some View {
        BSheet(title: "Escanear ticket") {
            if busy {
                BTile(padding: 28, spacing: 12, alignment: .center) {
                    ProgressView()
                    Text("Leyendo el ticket…").bTitle()
                    Text("Puede tardar unos segundos.").bSub()
                }
                .accessibilityElement(children: .combine)
            } else {
                BTile(style: .soft, spacing: 8) {
                    BAvatar(symbol: "doc.text.viewfinder", style: .solidAccent)
                    Text("Haz una foto a un ticket o factura").bTitle().padding(.top, 4)
                    Text("O elige una foto o una captura de un pago. Lee el comercio, el total y la fecha, y tú confirmas antes de guardar. La foto no se guarda.").bSub()
                }
                if cameraAvailable {
                    Button { showCamera = true } label: { Label("Hacer foto", systemImage: "camera") }.buttonStyle(.bPrimary)
                }
                PhotosPicker(selection: $picked, matching: .images) {
                    Label("Elegir de mis fotos", systemImage: "photo.on.rectangle")
                }
                .buttonStyle(cameraAvailable ? .bSecondary : .bPrimary)
                Text("Consejo: que se vea el total y que el ticket ocupe casi toda la foto.").bFootnote()
                if let error { BPill(text: error, style: .expense) }
            }
        }
        .onChange(of: picked) { _, item in
            guard let item else { return }
            Task {
                defer { picked = nil }
                guard let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else {
                    error = "No se ha podido abrir esa foto."
                    return
                }
                await scan(image)
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in
                showCamera = false
                if let image { Task { await scan(image) } }
            }
            .ignoresSafeArea()
        }
    }

    private func scan(_ image: UIImage) async {
        error = nil
        guard let b64 = ReceiptImage.base64(from: image) else { error = "No se ha podido preparar la foto."; return }
        busy = true
        defer { busy = false }
        do {
            let r: ScanReply = try await API.call("scan.receipt", ["image": .string(b64), "mime": .string("image/jpeg")])
            app.sheet = .scanned(MovementDraft(proposal: r.proposal, source: .ticket))
        } catch {
            self.error = API.map(error).message
        }
    }
}

struct ScanReply: Decodable {
    let proposal: MovementProposalDTO
    let remaining: Int
}

/// Reduce la foto antes de enviarla: lado largo de 1600 px y JPEG al 70 %. Basta para leer un ticket y pesa unos cientos de KB.
enum ReceiptImage {
    static func base64(from image: UIImage, maxSide: CGFloat = 1600, quality: CGFloat = 0.7) -> String? {
        let size = image.size
        let scale = min(1, maxSide / max(size.width, size.height))
        let target = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: target, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: target)) }
        return resized.jpegData(compressionQuality: quality)?.base64EncodedString()
    }
}

/// Cámara del sistema.
struct CameraPicker: UIViewControllerRepresentable {
    let onFinish: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let p = UIImagePickerController()
        p.sourceType = .camera
        p.delegate = context.coordinator
        return p
    }

    func updateUIViewController(_ vc: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onFinish: (UIImage?) -> Void
        init(onFinish: @escaping (UIImage?) -> Void) { self.onFinish = onFinish }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            onFinish(info[.originalImage] as? UIImage)
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { onFinish(nil) }
    }
}
