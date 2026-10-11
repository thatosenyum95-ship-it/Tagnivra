import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';

void main() => runApp(const TagnivraApp());

const navy = Color(0xFF080B25);
const panel = Color(0xFF111735);
const cyan = Color(0xFF25E4F2);
const purple = Color(0xFFA832FF);

class TagnivraApp extends StatelessWidget {
  const TagnivraApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Tagnivra',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: navy,
      colorScheme: ColorScheme.fromSeed(seedColor: purple, brightness: Brightness.dark),
      inputDecorationTheme: InputDecorationTheme(
        filled: true, fillColor: const Color(0xFF090E29),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: const BorderSide(color: Color(0xFF303965))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(13), borderSide: const BorderSide(color: Color(0xFF303965))),
      ),
    ),
    home: const GeneratorPage(),
  );
}

class GeneratorPage extends StatefulWidget {
  const GeneratorPage({super.key});
  @override
  State<GeneratorPage> createState() => _GeneratorPageState();
}

class _GeneratorPageState extends State<GeneratorPage> {
  final topic = TextEditingController();
  String platform = 'YouTube';
  String style = 'Umum';
  String language = 'Indonesia';
  List<String> hashtags = [];
  List<String> keywords = [];
  String get allResults => 'Platform: $platform\nTopik: ${topic.text.trim()}\n\nHashtag:\n${hashtags.join(' ')}\n\nKeyword & tag:\n${keywords.join('\n')}';

  List<String> words(String value) => value.toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
      .trim().split(RegExp(r'\s+')).where((s) => s.isNotEmpty).toList();

  void generate() {
    final raw = topic.text.trim();
    if (raw.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Masukkan topik konten dulu.')));
      return;
    }
    final base = words(raw).join(' ');
    final extras = platform == 'YouTube'
        ? ['tips', 'tutorial', 'indonesia', 'pemula', 'shorts']
        : platform == 'TikTok'
            ? ['fyp', 'tips', 'indonesia', 'video', 'trend']
            : ['reels', 'tips', 'komunitas', 'indonesia', 'video'];
    setState(() {
      hashtags = <String>{'#${words(raw).join('')}', ...extras.take(4).map((x) => '#${(base + x).replaceAll(' ', '')}'), '#${(style + base).replaceAll(' ', '').toLowerCase()}'}.take(8).toList();
      keywords = <String>{raw, ...words(raw), ...extras.map((x) => '$base $x'), '$style $base'}.take(12).toList();
    });
  }

  @override
  void dispose() { topic.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Container(
      decoration: const BoxDecoration(gradient: RadialGradient(center: Alignment.topRight, radius: 1.25, colors: [Color(0xFF21135A), navy])),
      child: SafeArea(child: ListView(padding: const EdgeInsets.fromLTRB(18, 20, 18, 32), children: [
        Row(children: [
          const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Tagnivra', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)), Text('AI TAG & HASHTAG STUDIO', style: TextStyle(fontSize: 11, color: Color(0xFFAAB3D9), letterSpacing: 1))]),
        ]),
        const SizedBox(height: 28),
        const Text('Bikin kontenmu lebih mudah ditemukan.', style: TextStyle(fontSize: 34, height: 1.12, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        const Text('Susun ide keyword, tag, dan hashtag sesuai platform.', style: TextStyle(color: Color(0xFFAAB3D9))),
        const SizedBox(height: 22),
        Card(color: panel, child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Pilih platform'),
          const SizedBox(height: 10),
          Wrap(spacing: 8, runSpacing: 8, children: ['YouTube', 'TikTok', 'Facebook'].map((p) => ChoiceChip(label: Text(p), selected: platform == p, onSelected: (_) => setState(() => platform = p)).toWidget()).toList()),
          const SizedBox(height: 18),
          const Text('Topik atau judul konten'),
          const SizedBox(height: 8),
          TextField(controller: topic, textInputAction: TextInputAction.done, onSubmitted: (_) => generate(), maxLength: 180, decoration: const InputDecoration(hintText: 'Contoh: resep nasi goreng sederhana', counterText: '')),
          const SizedBox(height: 12),
          const Text('Jenis konten'),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(value: style, items: ['Umum','Tutorial','Hiburan','Edukasi','Review','Gaming','Bisnis'].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(), onChanged: (v) => setState(() => style = v ?? 'Umum')),
          const SizedBox(height: 16),
          SizedBox(width: double.infinity, child: DecoratedBox(decoration: BoxDecoration(gradient: const LinearGradient(colors: [purple, Color(0xFF386DFF), Color(0xFF12BDDE)]), borderRadius: BorderRadius.circular(13)), child: ElevatedButton.icon(onPressed: generate, icon: const Icon(Icons.auto_awesome), label: const Text('Buat tag & hashtag'), style: ElevatedButton.styleFrom(backgroundColor: Colors.transparent, shadowColor: Colors.transparent, padding: const EdgeInsets.symmetric(vertical: 15))))),
          const SizedBox(height: 10),
          const Text('Saran awal berbasis kata, belum menggunakan data tren real-time.', style: TextStyle(fontSize: 12, color: Color(0xFFAAB3D9))),
        ]))),
        if (hashtags.isNotEmpty) ...[
          const SizedBox(height: 12),
          Card(color: panel, child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [const Expanded(child: Text('Hasil rekomendasi', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18))), TextButton.icon(onPressed: () async { await Clipboard.setData(ClipboardData(text: allResults)); if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Hasil disalin.'))); }, icon: const Icon(Icons.copy), label: const Text('Salin'))]),
            const SizedBox(height: 10),
            const Text('Hashtag', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(spacing: 7, runSpacing: 7, children: hashtags.map((x) => Chip(label: Text(x), backgroundColor: const Color(0xFF1B2350))).toList()),
            const SizedBox(height: 14),
            const Text('Keyword & tag', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(spacing: 7, runSpacing: 7, children: keywords.map((x) => Chip(label: Text(x), backgroundColor: const Color(0xFF1B2350))).toList()),
          ]))),
        ],
        const SizedBox(height: 20),
        const Center(child: Text('Saran otomatis bukan data tren aktual atau jaminan viral.', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Color(0xFF7F8AB8)))),
      ])),
    ),
  );
}

extension on Widget {
  Widget toWidget() => this;
}
