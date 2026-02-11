
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:screenshot/screenshot.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(
    ChangeNotifierProvider(
      create: (context) => TrackerProvider(prefs),
      child: const RamadanTrackerApp(),
    ),
  );
}

class RamadanTrackerApp extends StatelessWidget {
  const RamadanTrackerApp({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<TrackerProvider>(context);
    return MaterialApp(
      title: 'Ramadan Tracker',
      debugShowCheckedModeBanner: false,
      theme: provider.isDark ? _darkTheme : _lightTheme,
      home: const HomeScreen(),
    );
  }

  static final ThemeData _darkTheme = ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: const Color(0xFF0F172A),
    cardColor: const Color(0xFF1E293B),
    dividerColor: const Color(0xFF334155),
    primaryColor: const Color(0xFF10B981),
    colorScheme: const ColorScheme.dark(
      primary: Color(0xFF10B981),
      secondary: Color(0xFF059669),
      surface: Color(0xFF1E293B),
    ),
  );

  static final ThemeData _lightTheme = ThemeData(
    brightness: Brightness.light,
    scaffoldBackgroundColor: Colors.white,
    cardColor: const Color(0xFFF1F5F9),
    dividerColor: const Color(0xFFE2E8F0),
    primaryColor: const Color(0xFF10B981),
    colorScheme: const ColorScheme.light(
      primary: Color(0xFF10B981),
      secondary: Color(0xFF059669),
      surface: Color(0xFFF1F5F9),
    ),
  );
}

class DayData {
  Map<String, bool> circles;
  Map<String, String> rects;
  Map<String, String> notes;

  DayData({
    required this.circles,
    required this.rects,
    required this.notes,
  });

  Map<String, dynamic> toJson() => {
    'circles': circles,
    'rects': rects,
    'notes': notes,
  };

  factory DayData.fromJson(Map<String, dynamic> json) {
    return DayData(
      circles: Map<String, bool>.from(json['circles'] ?? {}),
      rects: Map<String, String>.from(json['rects'] ?? {}),
      notes: Map<String, String>.from(json['notes'] ?? {}),
    );
  }

  factory DayData.empty() => DayData(circles: {}, rects: {}, notes: {});

  bool get isEmpty {
    bool noCircles = circles.values.every((v) => v == false);
    bool noRects = rects.values.every((v) => v.trim().isEmpty);
    return noCircles && noRects;
  }
}

class TrackerProvider with ChangeNotifier {
  final SharedPreferences prefs;
  bool isDark = true;
  String appTitle = "Tracker";
  String userName = "User Name";
  String? userImagePath;
  int selectedDay = 0;
  bool removedT2 = false;
  Map<int, DayData> data = {};

  TrackerProvider(this.prefs) {
    _loadData();
  }

  void _loadData() {
    isDark = prefs.getBool('isDark') ?? true;
    appTitle = prefs.getString('appTitle') ?? "Tracker";
    userName = prefs.getString('userName') ?? "User Name";
    userImagePath = prefs.getString('userImagePath');
    removedT2 = prefs.getBool('removedT2') ?? false;
    
    String? dataJson = prefs.getString('trackerData');
    if (dataJson != null) {
      Map<String, dynamic> decoded = jsonDecode(dataJson);
      decoded.forEach((key, value) {
        data[int.parse(key)] = DayData.fromJson(value);
      });
    }
    notifyListeners();
  }

  void _saveData() {
    prefs.setBool('isDark', isDark);
    prefs.setString('appTitle', appTitle);
    prefs.setString('userName', userName);
    if (userImagePath != null) prefs.setString('userImagePath', userImagePath!);
    prefs.setBool('removedT2', removedT2);
    
    Map<String, dynamic> toEncode = {};
    data.forEach((key, value) => toEncode[key.toString()] = value.toJson());
    prefs.setString('trackerData', jsonEncode(toEncode));
  }

  void toggleTheme() {
    isDark = !isDark;
    _saveData();
    notifyListeners();
  }

  void updateTitle(String newTitle) {
    appTitle = newTitle;
    _saveData();
    notifyListeners();
  }

  void updateUserName(String newName) {
    userName = newName;
    _saveData();
    notifyListeners();
  }

  void updateUserImage(String path) {
    userImagePath = path;
    _saveData();
    notifyListeners();
  }

  void selectDay(int day) {
    selectedDay = day;
    notifyListeners();
  }

  void updateCircle(int day, String key, bool value) {
    if (!data.containsKey(day)) data[day] = DayData.empty();
    data[day]!.circles[key] = value;
    _checkAndCleanupDay(day);
    _saveData();
    notifyListeners();
  }

  void updateRect(int day, String key, String value) {
    if (!data.containsKey(day)) data[day] = DayData.empty();
    data[day]!.rects[key] = value;
    _checkAndCleanupDay(day);
    _saveData();
    notifyListeners();
  }

  void _checkAndCleanupDay(int day) {
    if (data.containsKey(day)) {
      if (data[day]!.isEmpty) {
        // If everything is unmarked and empty, we remove the key so it's not tracked.
        data.remove(day);
      }
    }
  }

  void updateNote(int day, String key, String value) {
    if (!data.containsKey(day)) data[day] = DayData.empty();
    data[day]!.notes[key] = value;
    _saveData();
    notifyListeners();
  }

  void deleteT2() {
    removedT2 = true;
    _saveData();
    notifyListeners();
  }

  void reset() {
    data.clear();
    selectedDay = 0;
    removedT2 = false;
    _saveData();
    notifyListeners();
  }

  int calculateDayStats(int day) {
    if (!data.containsKey(day)) return 0;
    final dayData = data[day]!;
    int totalCircles = removedT2 ? 6 : 7;
    int checkedCircles = dayData.circles.entries
        .where((e) => e.value && (removedT2 ? e.key != 'T2' : true))
        .length;
    int filledRects = dayData.rects.entries
        .where((e) => e.value.trim().isNotEmpty)
        .length;
    
    if (checkedCircles == 0 && filledRects == 0) return 0;

    double progress = ((checkedCircles + filledRects) / (totalCircles + 6)) * 100;
    return progress.round();
  }

  int getTrackedDaysCount() {
    // যেহেতু আমরা empty দিনগুলো সরিয়ে দিচ্ছি, তাই সরাসরি data keys গুনলেই হবে।
    // অথবা আরও নির্ভুল হওয়ার জন্য calculateDayStats > 0 চেক করা যেতে পারে।
    return data.keys.where((day) => calculateDayStats(day) > 0).length;
  }

  int calculateOverallEfficiency() {
    int trackedCount = getTrackedDaysCount();
    if (trackedCount == 0) return 0;
    
    int totalProgress = 0;
    data.keys.forEach((day) {
      int stats = calculateDayStats(day);
      if (stats > 0) totalProgress += stats;
    });
    
    return (totalProgress / trackedCount).round();
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final ScreenshotController screenshotController = ScreenshotController();
  final List<String> circleKeys = ['F', 'Z', 'A', 'M', 'E', 'T1', 'T2'];
  final List<String> rectKeys = ['QURAN', 'HADITH', 'SADKA', 'DUROOD', 'ISTIGFAAR', 'DUA'];

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<TrackerProvider>(context);

    return Scaffold(
      body: Screenshot(
        controller: screenshotController,
        child: Container(
          color: Theme.of(context).scaffoldBackgroundColor,
          child: SafeArea(
            child: Column(
              children: [
                _buildTopBar(provider),
                _buildHeaderGrid(provider),
                Expanded(child: _buildMainGrid(provider)),
                _buildFooter(provider),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTopBar(TrackerProvider provider) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const SizedBox(width: 80),
          GestureDetector(
            onLongPress: () => _showEditDialog("Rename Title", provider.appTitle, provider.updateTitle),
            child: Text(
              provider.appTitle,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ),
          Row(
            children: [
              GestureDetector(
                onLongPress: () {
                  HapticFeedback.heavyImpact();
                  provider.reset();
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Reset successful!")));
                },
                child: Text(
                  "RESET",
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).textTheme.bodySmall?.color?.withOpacity(0.5),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              IconButton(
                icon: Icon(provider.isDark ? Icons.light_mode : Icons.dark_mode, size: 20),
                onPressed: provider.toggleTheme,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderGrid(TrackerProvider provider) {
    final activeCircles = circleKeys.where((k) => !provider.removedT2 || k != 'T2').toList();
    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Row(
        children: [
          const SizedBox(width: 28, child: Center(child: Text("Day", style: TextStyle(fontSize: 8, fontWeight: FontWeight.black, color: Colors.grey)))),
          ...activeCircles.map((k) => Expanded(
            flex: 22,
            child: GestureDetector(
              onLongPress: k == 'T2' ? () => _showDeleteT2Confirm(provider) : null,
              child: Center(child: Text(k.startsWith('T') ? 'T' : k, style: const TextStyle(fontSize: 8, fontWeight: FontWeight.black, color: Colors.grey))),
            ),
          )),
          ...rectKeys.map((k) => Expanded(
            flex: 40,
            child: Center(child: Text(k, style: const TextStyle(fontSize: 5, fontWeight: FontWeight.black, color: Colors.grey), textAlign: TextAlign.center, overflow: TextOverflow.ellipsis)),
          )),
        ],
      ),
    );
  }

  Widget _buildMainGrid(TrackerProvider provider) {
    final activeCircles = circleKeys.where((k) => !provider.removedT2 || k != 'T2').toList();
    return ListView.separated(
      padding: const EdgeInsets.all(4),
      itemCount: 30,
      separatorBuilder: (context, index) => const SizedBox(height: 2),
      itemBuilder: (context, index) {
        final day = index + 1;
        final isActive = provider.selectedDay == day;
        final dayData = provider.data[day] ?? DayData.empty();

        return GestureDetector(
          onTap: () => provider.selectDay(day),
          child: Container(
            height: 28,
            decoration: BoxDecoration(
              color: isActive ? provider.primaryColor.withOpacity(0.1) : Colors.transparent,
              border: Border.all(color: isActive ? provider.primaryColor.withOpacity(0.3) : Colors.transparent),
              borderRadius: BorderRadius.circular(2),
            ),
            child: Row(
              children: [
                Container(
                  width: 28,
                  decoration: BoxDecoration(
                    color: isActive ? provider.primaryColor : Colors.transparent,
                    borderRadius: BorderRadius.circular(2),
                  ),
                  child: Center(child: Text("$day", style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: isActive ? Colors.white : null))),
                ),
                const SizedBox(width: 2),
                ...activeCircles.map((k) => Expanded(
                  flex: 22,
                  child: Padding(
                    padding: const EdgeInsets.all(2.0),
                    child: GestureDetector(
                      onTap: isActive ? () => provider.updateCircle(day, k, !(dayData.circles[k] ?? false)) : null,
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: (dayData.circles[k] ?? false) ? provider.primaryColor : Theme.of(context).cardColor,
                          border: Border.all(color: Theme.of(context).dividerColor),
                        ),
                        child: (dayData.circles[k] ?? false) ? const Icon(Icons.check, size: 10, color: Colors.white) : null,
                      ),
                    ),
                  ),
                )),
                ...rectKeys.map((k) => Expanded(
                  flex: 40,
                  child: Padding(
                    padding: const EdgeInsets.all(1.0),
                    child: GestureDetector(
                      onTap: isActive ? () => _showEditDialog(k, dayData.rects[k] ?? "", (val) => provider.updateRect(day, k, val)) : null,
                      onLongPress: isActive ? () => _showNotepad(k, day, provider) : null,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        decoration: BoxDecoration(
                          color: Theme.of(context).cardColor,
                          border: Border.all(color: Theme.of(context).dividerColor),
                          borderRadius: BorderRadius.circular(2),
                        ),
                        alignment: Alignment.centerLeft,
                        child: Text(dayData.rects[k] ?? "", style: const TextStyle(fontSize: 7, fontWeight: FontWeight.black), overflow: TextOverflow.ellipsis),
                      ),
                    ),
                  ),
                )),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildFooter(TrackerProvider provider) {
    return Container(
      height: 80,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: provider.isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
        border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: _pickImage,
            child: CircleAvatar(
              radius: 24,
              backgroundColor: provider.primaryColor,
              backgroundImage: provider.userImagePath != null ? FileImage(File(provider.userImagePath!)) : null,
              child: provider.userImagePath == null ? const Icon(Icons.person, color: Colors.white) : null,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  onTap: () => _showEditDialog("User Name", provider.userName, provider.updateUserName),
                  child: Text(provider.userName, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold), overflow: TextOverflow.ellipsis),
                ),
                Text(
                  "Selected Day’s Amal Progress: ${provider.selectedDay != 0 ? provider.calculateDayStats(provider.selectedDay) : '---'}%",
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.calculate, color: Color(0xFF10B981)),
            onPressed: () => _showInsights(provider),
          ),
          const SizedBox(width: 8),
          FloatingActionButton.small(
            onPressed: () => _export(provider),
            backgroundColor: provider.primaryColor,
            child: const Icon(Icons.download, color: Colors.white),
          ),
        ],
      ),
    );
  }

  void _showEditDialog(String title, String initialValue, Function(String) onSave) {
    final controller = TextEditingController(text: initialValue);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.black)),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: const TextStyle(fontWeight: FontWeight.bold),
          decoration: const InputDecoration(border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("CANCEL")),
          ElevatedButton(
            onPressed: () {
              onSave(controller.text);
              Navigator.pop(context);
            },
            child: const Text("SAVE"),
          ),
        ],
      ),
    );
  }

  void _showNotepad(String key, int day, TrackerProvider provider) {
    final controller = TextEditingController(text: provider.data[day]?.notes[key] ?? "");
    Navigator.push(context, MaterialPageRoute(builder: (context) => Scaffold(
      appBar: AppBar(title: Text("Notepad - $key")),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: TextField(
          controller: controller,
          maxLines: null,
          expands: true,
          decoration: const InputDecoration(hintText: "Write details...", border: InputBorder.none),
          onChanged: (val) => provider.updateNote(day, key, val),
        ),
      ),
    )));
  }

  void _showInsights(TrackerProvider provider) {
    Navigator.push(context, MaterialPageRoute(builder: (context) => Scaffold(
      appBar: AppBar(title: const Text("INSIGHTS"), centerTitle: true),
      body: Center(
        child: SingleChildScrollView(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircleAvatar(
                radius: 80,
                backgroundColor: provider.primaryColor,
                backgroundImage: provider.userImagePath != null ? FileImage(File(provider.userImagePath!)) : null,
                child: provider.userImagePath == null ? const Icon(Icons.person, size: 60, color: Colors.white) : null,
              ),
              const SizedBox(height: 20),
              Text(provider.userName, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.black)),
              const SizedBox(height: 10),
              const Text("PROFILE", style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.black, fontSize: 12, letterSpacing: 2)),
              const SizedBox(height: 40),
              Container(
                width: 280,
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: provider.primaryColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: provider.primaryColor.withOpacity(0.2)),
                ),
                child: Column(
                  children: [
                    Text("${provider.calculateOverallEfficiency()}%", style: TextStyle(fontSize: 64, fontWeight: FontWeight.black, color: provider.primaryColor)),
                    const Text("OVERALL EFFICIENCY", style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey, letterSpacing: 2)),
                  ],
                ),
              ),
              const SizedBox(height: 30),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _buildInsightCard("Tracked Days", "${provider.getTrackedDaysCount()}", provider),
                  const SizedBox(width: 12),
                  _buildInsightCard("Selected Day", "${provider.selectedDay != 0 ? provider.calculateDayStats(provider.selectedDay) : '0'}%", provider),
                ],
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    )));
  }

  Widget _buildInsightCard(String label, String value, TrackerProvider provider) {
    return Container(
      width: 134,
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 10),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        border: Border.all(color: Theme.of(context).dividerColor),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: provider.primaryColor)),
          const SizedBox(height: 6),
          Text(label.toUpperCase(), style: const TextStyle(fontSize: 8, fontWeight: FontWeight.black, color: Colors.grey, letterSpacing: 1), textAlign: TextAlign.center),
        ],
      ),
    );
  }

  void _pickImage() async {
    final ImagePicker picker = ImagePicker();
    final XFile? image = await picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      Provider.of<TrackerProvider>(context, listen: false).updateUserImage(image.path);
    }
  }

  void _showDeleteT2Confirm(TrackerProvider provider) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Delete Column"),
        content: const Text("Are you sure you want to remove the last 'T' column?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("CANCEL")),
          TextButton(onPressed: () {
            provider.deleteT2();
            Navigator.pop(context);
          }, child: const Text("DELETE", style: TextStyle(color: Colors.red))),
        ],
      ),
    );
  }

  void _export(TrackerProvider provider) async {
    final image = await screenshotController.capture();
    if (image != null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Exported successfully!")));
    }
  }
}
