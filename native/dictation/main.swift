import AVFoundation
import Foundation
import Speech

final class RecordingEnd: NSObject, AVAudioRecorderDelegate {
  func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
    exit(flag ? 0 : 1)
  }

  func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
    exit(1)
  }
}

let recordingEnd = RecordingEnd()

func transcriber(_ locale: Locale) -> SpeechTranscriber {
  SpeechTranscriber(locale: locale, preset: .transcription)
}

func prepare() async throws {
  guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale.current) else {
    exit(2)
  }
  if let request = try await AssetInventory.assetInstallationRequest(supporting: [transcriber(locale)]) {
    try await request.downloadAndInstall()
  }
  print(locale.identifier(.bcp47))
}

func transcribe(_ identifier: String, _ path: String) async throws {
  let module = transcriber(Locale(identifier: identifier))
  let analyzer = SpeechAnalyzer(modules: [module])
  let text = Task { try await module.results.reduce("") { $0 + String($1.text.characters) } }
  if let end = try await analyzer.analyzeSequence(from: AVAudioFile(forReading: URL(fileURLWithPath: path))) {
    try await analyzer.finalizeAndFinish(through: end)
  } else {
    await analyzer.cancelAndFinishNow()
  }
  print(try await text.value)
}

func record(_ path: String, _ seconds: TimeInterval) throws {
  let recorder = try AVAudioRecorder(
    url: URL(fileURLWithPath: path),
    settings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 16_000, AVNumberOfChannelsKey: 1]
  )
  recorder.delegate = recordingEnd
  guard recorder.record(forDuration: seconds) else { exit(1) }
  Thread.detachNewThread {
    _ = FileHandle.standardInput.readDataToEndOfFile()
    DispatchQueue.main.async { recorder.stop() }
  }
}

func run(_ command: @escaping () async throws -> Void) {
  Task {
    do {
      try await command()
      exit(0)
    } catch {
      FileHandle.standardError.write(Data("\(error)\n".utf8))
      exit(1)
    }
  }
}

let arguments = CommandLine.arguments
switch (arguments.count, arguments.dropFirst().first) {
case (2, "prepare"): run(prepare)
case (4, "transcribe"): run { try await transcribe(arguments[2], arguments[3]) }
case (4, "record"): try record(arguments[2], TimeInterval(arguments[3]) ?? 0)
default: exit(64)
}
RunLoop.main.run()
