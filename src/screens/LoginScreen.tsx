//src/screens/LoginScreen.tsx
import React, {useState} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import Icon from "@react-native-vector-icons/material-icons"; // Updated import

import {supabase} from "../lib/supabase";

export default function LoginScreen({onLogin}: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    const {data, error} = await supabase.auth.signInWithPassword({
      email,
      password
    });
    setLoading(false);

    if (error) {
      Alert.alert("Login Error", error.message);
      return;
    }

    onLogin(data.session);
  }

  async function signup() {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    const {data, error} = await supabase.auth.signUp({
      email,
      password
    });
    setLoading(false);

    if (error) {
      Alert.alert("Signup Error", error.message);
      return;
    }

    if (data.session) {
      onLogin(data.session);
    } else {
      Alert.alert(
        "Account Created",
        "Please check your email to verify your account"
      );
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>
            Wellness AI 🌿
          </Text>
          <Text style={styles.subtitle}>
            Your mental wellness companion
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Icon name="email" size={24} color="#1565C0" style={styles.inputIcon} />
            <TextInput
              placeholder="Email"
              placeholderTextColor="#90A4AE"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Icon name="lock" size={24} color="#1565C0" style={styles.inputIcon} />
            <TextInput
              placeholder="Password"
              placeholderTextColor="#90A4AE"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              style={[styles.input, {flex: 1}]}
              autoCapitalize="none"
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Icon 
                name={showPassword ? "visibility" : "visibility-off"} 
                size={24} 
                color="#1565C0" 
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={login}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.signupButton}
            onPress={signup}
            disabled={loading}
          >
            <Text style={styles.signupText}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E3F2FD",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 25,
  },
  header: {
    marginBottom: 50,
  },
  logo: {
    fontSize: 40,
    fontWeight: "bold",
    textAlign: "center",
    color: "#0D47A1",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#1565C0",
    fontWeight: "500",
  },
  form: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#0D47A1",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F9FF",
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#BBDEFB",
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    paddingVertical: 14,
    fontSize: 16,
    color: "#0D47A1",
    flex: 1,
  },
  eyeButton: {
    padding: 8,
  },
  button: {
    backgroundColor: "#1565C0",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#1565C0",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  dividerText: {
    marginHorizontal: 15,
    color: "#90A4AE",
    fontSize: 14,
  },
  signupButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#1565C0",
  },
  signupText: {
    color: "#1565C0",
    fontWeight: "600",
    fontSize: 16,
  },
  footer: {
    marginTop: 25,
    textAlign: "center",
    color: "#78909C",
    fontSize: 12,
  },
});