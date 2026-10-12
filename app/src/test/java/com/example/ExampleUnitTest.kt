package com.example

import com.example.domain.AppConfigGenerator
import com.example.domain.ValidationUtil
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ExampleUnitTest {
  @Test
  fun addition_isCorrect() {
    assertEquals(4, 2 + 2)
  }

  @Test
  fun validateWebUrl_correctUrls() {
    assertTrue(ValidationUtil.validateWebUrl("https://example.com").isValid)
    assertTrue(ValidationUtil.validateWebUrl("http://myportfolio.id").isValid)
  }

  @Test
  fun validateWebUrl_ssrfBlocked() {
    assertFalse(ValidationUtil.validateWebUrl("http://localhost:3000").isValid)
    assertFalse(ValidationUtil.validateWebUrl("http://127.0.0.1/admin").isValid)
    assertFalse(ValidationUtil.validateWebUrl("http://169.254.169.254/latest/meta-data").isValid)
    assertFalse(ValidationUtil.validateWebUrl("http://192.168.1.1").isValid)
  }

  @Test
  fun validatePackageName_rules() {
    assertTrue(ValidationUtil.validatePackageName("com.faizfahmiid.myapp").isValid)
    assertFalse(ValidationUtil.validatePackageName("invalid").isValid)
    assertFalse(ValidationUtil.validatePackageName("com.example.my-app").isValid)
    assertFalse(ValidationUtil.validatePackageName("com.example.class").isValid)
  }

  @Test
  fun appConfigGenerator_outputContainsExpectedFields() {
    val kotlinCode = AppConfigGenerator.generateAppConfigKotlin(
      webUrl = "https://example.com",
      appName = "My Awesome App",
      pullToRefresh = true
    )
    assertTrue(kotlinCode.contains("const val WEB_URL = \"https://example.com\""))
    assertTrue(kotlinCode.contains("const val APP_TITLE = \"My Awesome App\""))
    assertTrue(kotlinCode.contains("const val ENABLE_PULL_TO_REFRESH = true"))
  }

  @Test
  fun parseGitHubRepoUrl_extractsOwnerAndRepo() {
    val result1 = ValidationUtil.parseGitHubRepoUrl("https://github.com/cah-coding-25/webtoapp_faizfahmiid_2026")
    assertEquals("cah-coding-25", result1?.first)
    assertEquals("webtoapp_faizfahmiid_2026", result1?.second)

    val result2 = ValidationUtil.parseGitHubRepoUrl("github.com/my-org/my-project.git")
    assertEquals("my-org", result2?.first)
    assertEquals("my-project", result2?.second)

    val result3 = ValidationUtil.parseGitHubRepoUrl("faiz/cool_app")
    assertEquals("faiz", result3?.first)
    assertEquals("cool_app", result3?.second)
  }
}

