import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  static const ink = Color(0xFF102033);
  static const muted = Color(0xFF72839A);
  static const page = Color(0xFFF7FBFF);
  static const card = Color(0xFFFFFFFF);
  static const line = Color(0xFFD8E8FF);
  static const primary = Color(0xFF1E63F2);
  static const primaryDark = Color(0xFF102A5C);
  static const accent = Color(0xFF16A8F5);
  static const warning = Color(0xFFF0C64D);
  static const danger = Color(0xFFE94B55);
  static const festival = Color(0xFF4F79D8);
  static const early = Color(0xFFFF8659);
}

class AppTheme {
  static ThemeData light() {
    const colorScheme = ColorScheme.light(
      primary: AppColors.primary,
      secondary: AppColors.accent,
      surface: AppColors.card,
      error: AppColors.danger,
      onPrimary: Colors.white,
      onSurface: AppColors.ink,
    );
    final baseTheme = ThemeData(useMaterial3: true, colorScheme: colorScheme);
    final poppinsTextTheme = GoogleFonts.poppinsTextTheme(
      baseTheme.textTheme,
    ).apply(bodyColor: AppColors.ink, displayColor: AppColors.ink);

    return baseTheme.copyWith(
      scaffoldBackgroundColor: AppColors.page,
      textTheme: poppinsTextTheme,
      primaryTextTheme: GoogleFonts.poppinsTextTheme(
        baseTheme.primaryTextTheme,
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: CupertinoPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.windows: CupertinoPageTransitionsBuilder(),
        },
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        centerTitle: true,
        backgroundColor: AppColors.page,
        foregroundColor: AppColors.ink,
        titleTextStyle: GoogleFonts.poppins(
          color: AppColors.ink,
          fontSize: 17,
          fontWeight: FontWeight.w700,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.card,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 13,
        ),
        hintStyle: GoogleFonts.poppins(color: AppColors.muted, fontSize: 13),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: AppColors.card,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: AppColors.line),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: GoogleFonts.poppins(
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primaryDark,
          side: const BorderSide(color: AppColors.line),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w700),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: GoogleFonts.poppins(fontWeight: FontWeight.w700),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.card,
        selectedColor: AppColors.primary,
        labelStyle: GoogleFonts.poppins(fontSize: 12, color: AppColors.ink),
        secondaryLabelStyle: GoogleFonts.poppins(
          fontSize: 12,
          color: Colors.white,
        ),
        side: const BorderSide(color: AppColors.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }
}
